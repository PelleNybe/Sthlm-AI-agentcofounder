💡 What:
- Memoized `MetricCard` and `CustomTooltip` components in `Dashboard.tsx`.
- Wrapped data derived configurations in `useMemo` where appropriate.
- Updated event handlers like theme switches and local storage setters to use `useCallback` to maintain reference equality.
- Optimized `useTheme` hook with `matchMedia` listener.
- Updated bundle configuration in `vite.config.ts` to code-split third-party libraries (react, recharts, lucide-react) and reduce main chunk size.
- Added `aria-expanded` attributes to toggles.

🎯 Why:
The `Dashboard.tsx` component relies on `Recharts`, which can trigger multiple renders when interacting with the graphs. Memoizing these components reduces unnecessary react render cycles. Code splitting via Vite reduces initial page load times and resolves the "chunk larger than 500kb" warning. Adding ARIA attributes increases accessibility compliance.

📊 Impact:
- Prevents unnecessary DOM reflows and React renders during dashboard interaction.
- Smaller initial JavaScript bundles leading to faster TTI (Time to Interactive).
- Better screen reader support for the settings menu and mobile navigation toggles.

🔬 Measurement:
- Run `npm run app:build` and verify the chunk size warnings are gone, and new chunks (`vendor`, `charts`, `icons`) are correctly split.
- Use React Profiler on the dashboard to observe fewer re-renders for `MetricCard` and `CustomTooltip` on state changes.
- Check accessibility using Lighthouse or similar tools to verify ARIA attribute correctness.
