import { createTheme } from "@mui/material/styles"

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#1e9be9",
      light: "#4cb7ff",
      dark: "#0b4f7a",
    },
    secondary: {
      main: "#f5c045",
      light: "#ffe082",
      dark: "#b8860b",
    },
    background: {
      default: "#040813",
      paper: "rgba(12, 18, 34, 0.92)",
    },
    text: {
      primary: "#f6f8ff",
      secondary: "#9ca7c7",
    },
    divider: "rgba(30, 155, 233, 0.22)",
  },
  typography: {
    fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    h1: {
      fontWeight: 600,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontWeight: 600,
      letterSpacing: "-0.015em",
    },
    h3: {
      fontWeight: 600,
    },
    subtitle1: {
      color: "#b6c1df",
      fontWeight: 500,
    },
    body1: {
      lineHeight: 1.7,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "radial-gradient(circle at top, rgba(30,155,233,0.12), transparent 45%), radial-gradient(circle at 20% 80%, rgba(245,192,69,0.12), transparent 55%)",
          backgroundColor: "#040813",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: "0.02em",
          borderRadius: 999,
          paddingInline: "1.5rem",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backdropFilter: "blur(24px)",
          backgroundColor: "rgba(10, 16, 32, 0.9)",
          border: "1px solid rgba(30, 155, 233, 0.08)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage:
            "linear-gradient(135deg, rgba(10, 16, 32, 0.96), rgba(13, 24, 46, 0.96))",
          border: "1px solid rgba(30, 155, 233, 0.18)",
          boxShadow: "0 18px 48px rgba(5, 8, 21, 0.5)",
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          paddingBottom: 0,
        },
        subheader: {
          color: "#9ca7c7",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(30, 155, 233, 0.12)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(30, 155, 233, 0.16)",
          color: "#d4e5ff",
        },
      },
    },
  },
})

export default theme
