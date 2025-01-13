import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Layout } from './components/Layout';
import { GameLibrary } from './components/GameLibrary';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Layout>
        <GameLibrary />
      </Layout>
    </ThemeProvider>
  );
}

export default App;