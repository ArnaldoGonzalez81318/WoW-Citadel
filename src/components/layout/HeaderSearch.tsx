import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import {
  Box,
  Collapse,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { ChangeEvent, useCallback, useState } from "react"
import { useSearchState } from "@/features/search/context/SearchContext"

const HeaderSearch = (): JSX.Element => {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"))
  const { query, setQuery } = useSearchState()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value)
    },
    [setQuery]
  )

  const toggleMobile = useCallback(() => {
    setMobileOpen((current) => !current)
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const clearQuery = useCallback(() => setQuery(""), [setQuery])

  const renderTextField = (variant: "desktop" | "mobile") => (
    <TextField
      fullWidth
      value={query}
      onChange={handleChange}
      autoFocus={variant === "mobile"}
      placeholder="Search items, talents, realms, and more"
      variant="outlined"
      size="small"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchRoundedIcon color="primary" fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: query ? (
          <InputAdornment position="end">
            <IconButton edge="end" size="small" aria-label="Clear search" onClick={clearQuery}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
        sx: {
          height: 48,
          bgcolor: "rgba(10, 16, 32, 0.82)",
          borderRadius: 3,
          border: "1px solid rgba(30, 155, 233, 0.14)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 26px rgba(4, 8, 19, 0.18)",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
          "&:hover": {
            borderColor: "rgba(76, 183, 255, 0.32)",
            backgroundColor: "rgba(14, 22, 42, 0.9)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 28px rgba(4, 8, 19, 0.24)",
          },
          "&.Mui-focused": {
            borderColor: "rgba(76, 183, 255, 0.45)",
            boxShadow: "0 0 0 4px rgba(30, 155, 233, 0.16)",
            backgroundColor: "rgba(12, 20, 40, 0.92)",
          },
        },
      }}
      sx={{
        minWidth: variant === "desktop" ? 360 : undefined,
        maxWidth: variant === "desktop" ? 520 : undefined,
        "& fieldset": {
          border: "none",
        },
      }}
    />
  )

  if (isDesktop) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", position: "relative", width: "100%" }}>
        {renderTextField("desktop")}
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", position: "relative", width: "100%" }}>
      <IconButton
        color="inherit"
        aria-label="Toggle search"
        onClick={toggleMobile}
        sx={{
          width: 46,
          height: 46,
          borderRadius: 3,
          border: "1px solid rgba(30, 155, 233, 0.14)",
          backgroundColor: mobileOpen ? "rgba(20, 32, 56, 0.92)" : "rgba(10, 16, 32, 0.78)",
          boxShadow: "0 10px 22px rgba(4, 8, 19, 0.16)",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
          "&:hover": {
            backgroundColor: "rgba(20, 32, 56, 0.96)",
            borderColor: "rgba(76, 183, 255, 0.28)",
          },
        }}
      >
        {mobileOpen ? <CloseRoundedIcon /> : <SearchRoundedIcon />}
      </IconButton>
      <Collapse in={mobileOpen} orientation="vertical" unmountOnExit>
        <Paper
          elevation={6}
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            mt: 1,
            px: 1.5,
            py: 1.5,
            borderRadius: 3,
            border: "1px solid rgba(30, 155, 233, 0.16)",
            background: "linear-gradient(145deg, rgba(9, 15, 30, 0.98), rgba(16, 26, 48, 0.96))",
            boxShadow: "0 24px 40px rgba(4, 8, 19, 0.38)",
            zIndex: 2,
          }}
        >
          {renderTextField("mobile")}
        </Paper>
      </Collapse>
      {mobileOpen ? (
        <Box
          onClick={closeMobile}
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
          }}
        />
      ) : null}
    </Box>
  )
}

export default HeaderSearch
