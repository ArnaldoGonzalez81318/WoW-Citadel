import {
  FocusEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Box,
  Button,
  Grid,
  Link,
  Popover,
  Stack,
  Typography,
} from "@mui/material"
import type { NavFlyoutSection } from "@/components/layout/navigation/navConfig"
import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig"

const NavFlyout = (): JSX.Element => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const activeSection = useMemo<NavFlyoutSection | null>(() => {
    if (!activeSectionId) {
      return null
    }

    return NAV_SECTIONS.find((section) => section.id === activeSectionId) ?? null
  }, [activeSectionId])

  const open = Boolean(anchorEl && activeSection)

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setAnchorEl(null)
      setActiveSectionId(null)
    }, 220)
  }, [])

  const handleMouseOpen = useCallback(
    (section: NavFlyoutSection) => (event: MouseEvent<HTMLElement>) => {
      clearCloseTimer()
      setAnchorEl(event.currentTarget)
      setActiveSectionId(section.id)
    },
    []
  )

  const handleFocusOpen = useCallback(
    (section: NavFlyoutSection) => (event: FocusEvent<HTMLElement>) => {
      clearCloseTimer()
      setAnchorEl(event.currentTarget)
      setActiveSectionId(section.id)
    },
    []
  )

  const handleClose = useCallback(() => {
    clearCloseTimer()
    setAnchorEl(null)
    setActiveSectionId(null)
  }, [])

  const isWithin = useCallback((element: HTMLElement | null, target: EventTarget | null) => {
    if (!element || !target) {
      return false
    }
    return element.contains(target as Node)
  }, [])

  const handleNavBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (isWithin(navRef.current, next) || isWithin(popoverRef.current, next as EventTarget)) {
        return
      }
      scheduleClose()
    },
    [isWithin, scheduleClose]
  )

  const handlePopoverBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (isWithin(navRef.current, next) || isWithin(popoverRef.current, next as EventTarget)) {
        return
      }
      scheduleClose()
    },
    [isWithin, scheduleClose]
  )

  const handleNavMouseEnter = useCallback(() => {
    clearCloseTimer()
  }, [])

  const handleNavMouseLeave = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (isWithin(navRef.current, next) || isWithin(popoverRef.current, next)) {
        return
      }
      scheduleClose()
    },
    [isWithin, scheduleClose]
  )

  const handlePopoverMouseLeave = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (isWithin(navRef.current, next) || isWithin(popoverRef.current, next)) {
        return
      }
      scheduleClose()
    },
    [isWithin, scheduleClose]
  )

  const registerPopoverRef = useCallback((node: HTMLDivElement | null) => {
    popoverRef.current = node
  }, [])

  useEffect(() => () => clearCloseTimer(), [])

  const popoverId = useMemo(() => {
    if (!open || !activeSection) {
      return undefined
    }

    return `nav-flyout-${activeSection.id}`
  }, [open, activeSection])

  return (
    <Box
      component="nav"
      ref={navRef}
      sx={{ display: "flex", alignItems: "center", gap: 1 }}
      onMouseEnter={handleNavMouseEnter}
      onMouseLeave={handleNavMouseLeave}
      onFocusCapture={clearCloseTimer}
      onBlurCapture={handleNavBlur}
    >
      {NAV_SECTIONS.map((section) => (
        <Button
          key={section.id}
          color="inherit"
          onMouseEnter={handleMouseOpen(section)}
          onFocus={handleFocusOpen(section)}
          aria-haspopup="true"
          aria-expanded={open && activeSection?.id === section.id ? "true" : undefined}
          aria-controls={popoverId}
          sx={{
            color: "text.secondary",
            fontWeight: 600,
            letterSpacing: "0.02em",
            borderRadius: 2,
            px: 1.5,
            textTransform: "none",
            "&:hover": {
              backgroundColor: "rgba(30, 155, 233, 0.12)",
              color: "primary.light",
            },
          }}
        >
          {section.label}
        </Button>
      ))}

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableRestoreFocus
        slotProps={{
          paper: {
            onMouseEnter: clearCloseTimer,
            onMouseLeave: handlePopoverMouseLeave,
            onFocusCapture: clearCloseTimer,
            onBlurCapture: handlePopoverBlur,
            ref: registerPopoverRef,
            sx: {
              pointerEvents: "auto",
              borderRadius: 3,
              mt: 1,
              width: { xs: 320, sm: 420, md: 560 },
              backgroundColor: "rgba(10, 16, 32, 0.94)",
              border: "1px solid rgba(30, 155, 233, 0.18)",
              boxShadow: "0 32px 60px rgba(4, 8, 19, 0.6)",
            },
          },
        }}
      >
        {activeSection ? (
          <Box sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2} sx={{ mb: 2 }}>
              <Typography variant="overline" sx={{ letterSpacing: "0.28em", color: "secondary.light" }}>
                {activeSection.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activeSection.description}
              </Typography>
            </Stack>
            <Grid container spacing={2} columns={{ xs: 1, sm: 2 }}>
              {activeSection.items.map((item) => (
                <Grid item xs={1} sm={1} key={item.id}>
                  <Link
                    href={item.href}
                    underline="none"
                    sx={{
                      display: "block",
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "rgba(12, 18, 34, 0.75)",
                      border: "1px solid transparent",
                      transition: "all 0.18s ease",
                      "&:hover": {
                        borderColor: "rgba(30, 155, 233, 0.45)",
                        backgroundColor: "rgba(20, 32, 56, 0.85)",
                      },
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  </Link>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}
      </Popover>
    </Box>
  )
}

export default NavFlyout
