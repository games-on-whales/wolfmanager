import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Layout } from './components/Layout';
import { GameLibrary } from './components/GameLibrary';
import { useState } from 'react';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Layout onSearch={setSearchQuery}>
        <GameLibrary searchQuery={searchQuery} />
      </Layout>
    </ThemeProvider>
  );
};

export default App;