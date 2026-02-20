// Updated line 187 to use a more specific selector
const filterButton = getByRole('button', { name: 'Filter' }).getByAttribute('data-filter', 'completed');