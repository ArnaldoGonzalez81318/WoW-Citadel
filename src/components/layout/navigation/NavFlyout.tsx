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
  Grow,
  Grid,
  Link,
  Paper,
  Popper,
  Stack,
  Typography,
} from "@mui/material"
import { Link as RouterLink } from "react-router-dom"
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

    if (target instanceof Node) {
      return element.contains(target)
    }

    return false
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
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.75,
        py: 0.75,
        borderRadius: 999,
        border: "1px solid rgba(30, 155, 233, 0.12)",
        backgroundColor: "rgba(10, 16, 32, 0.62)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
        overflowX: "auto",
      }}
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
            color: open && activeSection?.id === section.id ? "text.primary" : "text.secondary",
            fontWeight: 600,
            letterSpacing: "0.02em",
            borderRadius: 999,
            px: 1.75,
            py: 0.9,
            textTransform: "none",
            whiteSpace: "nowrap",
            background:
              open && activeSection?.id === section.id
                ? "linear-gradient(135deg, rgba(30,155,233,0.2), rgba(245,192,69,0.14))"
                : "transparent",
            border: open && activeSection?.id === section.id ? "1px solid rgba(76, 183, 255, 0.18)" : "1px solid transparent",
            "&:hover": {
              backgroundColor: "rgba(30, 155, 233, 0.12)",
              color: "primary.light",
            },
          }}
        >
          {section.label}
        </Button>
      ))}

      <Popper
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        transition
        modifiers={[
          {
            name: "offset",
            options: {
              offset: [0, 12],
            },
          },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.appBar + 1 }}
      >
        {({ TransitionProps }) =>
          activeSection ? (
            <Grow
              {...TransitionProps}
              timeout={{ enter: 180 }}
              style={{ transformOrigin: "left top" }}
            >
              <Paper
                onMouseEnter={clearCloseTimer}
                onMouseLeave={handlePopoverMouseLeave}
                onFocusCapture={clearCloseTimer}
                onBlurCapture={handlePopoverBlur}
                ref={registerPopoverRef}
                sx={{
                  pointerEvents: "auto",
                  borderRadius: 4,
                  width: { xs: 320, sm: 420, md: 560 },
                  background: "linear-gradient(155deg, rgba(8, 14, 28, 0.98), rgba(14, 24, 46, 0.96))",
                  border: "1px solid rgba(30, 155, 233, 0.18)",
                  boxShadow: "0 32px 60px rgba(4, 8, 19, 0.6)",
                  overflow: "hidden",
                  "&::before": {
                    content: "''",
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(circle at top right, rgba(245,192,69,0.16), transparent 38%), radial-gradient(circle at left, rgba(30,155,233,0.16), transparent 42%)",
                    pointerEvents: "none",
                  },
                }}
              >
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
                          {...(item.path
                            ? { component: RouterLink, to: item.path }
                            : { href: item.href })}
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
                          onClick={item.path ? handleClose : undefined}
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
              </Paper>
            </Grow>
          ) : null
        }
      </Popper>
    </Box>
  )
}

export default NavFlyout
