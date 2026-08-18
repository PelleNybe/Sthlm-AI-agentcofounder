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
  async fetchTrendingRepositories(language: string, limit: number = 10): Promise<GitHubRepository[]> {
    // We'll search for repositories sorted by stars
    // Date filter helps find "trending" (e.g., created recently or active recently)
    // To keep it simple and likely to return results, we just search for highly starred repos in that language.
    const query = `language:${language}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;

    try {
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
    } catch (error) {
      if (error instanceof GitHubRateLimitError || error instanceof GitHubNetworkError || error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubNetworkError(`Network failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
