const { QueryClient } = require('@tanstack/query-core');
const client = new QueryClient();
const query = client.getQueryCache().build(client, { queryKey: ['test'] });
console.log('isLoading in state?', 'isLoading' in query.state);
console.log('isPending in state?', 'isPending' in query.state);
