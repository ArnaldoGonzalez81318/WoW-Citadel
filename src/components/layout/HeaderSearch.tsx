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
        sx: {
          bgcolor: "rgba(12, 18, 34, 0.85)",
          borderRadius: 999,
        },
      }}
      sx={{
        minWidth: variant === "desktop" ? 340 : undefined,
        maxWidth: variant === "desktop" ? 420 : undefined,
        "& fieldset": {
          borderColor: "rgba(30, 155, 233, 0.2)",
        },
      }}
    />
  )

  if (isDesktop) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
        {renderTextField("desktop")}
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
      <IconButton
        color="inherit"
        aria-label="Toggle search"
        onClick={toggleMobile}
        sx={{
          borderRadius: 2,
          backgroundColor: mobileOpen ? "rgba(30, 155, 233, 0.18)" : "transparent",
          transition: "background-color 0.2s ease",
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
            px: 2,
            py: 2,
            borderRadius: 3,
            background:
              "linear-gradient(135deg, rgba(30,155,233,0.18), rgba(245,192,69,0.16))",
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
