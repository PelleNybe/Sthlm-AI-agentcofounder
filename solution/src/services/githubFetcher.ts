import CircuitBreaker from 'opossum';

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubNetworkError';
  }
}

export class GitHubApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

export class GithubFetcherService {
  private breaker: CircuitBreaker;

  constructor() {
    this.breaker = new CircuitBreaker(this.executeFetch.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });
  }

  private async executeFetch(url: string): Promise<GitHubRepository[]> {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AgentCofounder-GitHub-Fetcher'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new GitHubRateLimitError('Rate limit exceeded or access forbidden.');
      }
      if (response.status >= 500) {
        throw new GitHubNetworkError(`GitHub API network error: ${response.status} ${response.statusText}`);
      }
      throw new GitHubApiError(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items as GitHubRepository[];
  }

  async fetchTrendingRepositories(language: string, limit: number = 10): Promise<GitHubRepository[]> {
    const query = `language:${language}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;

    try {
      return await this.breaker.fire(url) as GitHubRepository[];
    } catch (error: any) {
      if (error.code === 'EOPENBREAKER') {
        throw new GitHubNetworkError('Service Unavailable: Circuit breaker is open');
      }
      if (error instanceof GitHubRateLimitError || error instanceof GitHubNetworkError || error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubNetworkError(`Network failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
