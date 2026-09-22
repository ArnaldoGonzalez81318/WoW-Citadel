import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import {
  Box,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import Logo from "@/components/layout/Logo";
import RegionBadge from "@/components/layout/RegionBadge";
import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig";
import { API_REFERENCE_URL } from "@/components/layout/navigation/navUtils";
import { focusRing } from "@/theme";

type FooterInternalLink = { label: string; to: string };
type FooterExternalLink = { label: string; href: string };

const FOOTER_INTERNAL_LINKS: FooterInternalLink[] = [
  { label: "Home", to: "/" },
  { label: "Search", to: "/search" },
];

const FOOTER_RESOURCE_LINKS: FooterExternalLink[] = [
  {
    label: "GitHub Repository",
    href: "https://github.com/ArnaldoGonzalez81318/WoW-Citadel",
  },
  {
    label: "Blizzard API Portal",
    href: "https://develop.battle.net/",
  },
  {
    label: "API Reference",
    href: API_REFERENCE_URL,
  },
];

/** package.json version injected by vite.config `define` (dev and build). */
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

const FooterLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body2,
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  minHeight: 32,
  color: theme.palette.text.secondary,
  textDecoration: "none",
  borderRadius: `${theme.wc.radius.sm}px`,
  transition: theme.transitions.create("color", {
    duration: theme.wc.motion.base,
    easing: theme.wc.motion.easing,
  }),
  "&:hover": {
    color: theme.palette.text.primary,
    textDecoration: "none",
  },
  "&:focus-visible": focusRing(theme),
  // styled() drops Link's polymorphic `component` typing; restore it.
})) as typeof Link;

const FooterHeading = ({
  id,
  children,
}: {
  id: string;
  children: string;
}): JSX.Element => (
  <Typography id={id} component="h2" variant="overline" color="text.secondary">
    {children}
  </Typography>
);

/**
 * Compact site footer: brand + region, a sitemap generated from
 * NAV_SECTIONS, external resources, and the legal / data line.
 */
const Footer = (): JSX.Element => {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={(theme) => ({
        borderTop: `1px solid ${theme.palette.border.subtle}`,
        bgcolor: "surface.raised",
        py: { xs: 4, md: 5 },
      })}
    >
      <Container maxWidth="xl">
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "1.5fr repeat(5, minmax(0, 1fr))",
            },
          }}
        >
          <Stack
            spacing={2}
            alignItems="flex-start"
            sx={{ gridColumn: { xs: "1 / -1", lg: "auto" } }}
          >
            <Logo />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: "40ch" }}
            >
              Blizzard&apos;s live game data, readable.
            </Typography>
            <RegionBadge />
          </Stack>

          <Box component="nav" aria-label="Site map" sx={{ display: "contents" }}>
            {NAV_SECTIONS.map((section) => {
              const headingId = `footer-${section.id}`;
              return (
                <Stack
                  key={section.id}
                  component="section"
                  aria-labelledby={headingId}
                  spacing={0.5}
                  alignItems="flex-start"
                >
                  <FooterHeading id={headingId}>{section.label}</FooterHeading>
                  {section.items.map((item) => (
                    <FooterLink key={item.id} component={RouterLink} to={item.path}>
                      {item.label}
                    </FooterLink>
                  ))}
                </Stack>
              );
            })}
          </Box>

          <Stack
            component="section"
            aria-labelledby="footer-resources"
            spacing={0.5}
            alignItems="flex-start"
          >
            <FooterHeading id="footer-resources">Resources</FooterHeading>
            {FOOTER_INTERNAL_LINKS.map((link) => (
              <FooterLink key={link.to} component={RouterLink} to={link.to}>
                {link.label}
              </FooterLink>
            ))}
            {FOOTER_RESOURCE_LINKS.map((link) => (
              <FooterLink
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} (opens in a new tab)`}
              >
                {link.label}
                <OpenInNewRounded fontSize="inherit" aria-hidden="true" />
              </FooterLink>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: { xs: 3, md: 4 } }} />

        <Stack
          direction="row"
          flexWrap="wrap"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={2}
        >
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={{ maxWidth: "72ch", m: 0 }}
          >
            &copy; {year} WoW Citadel &middot; Independent fan project, not
            affiliated with or endorsed by Blizzard Entertainment. World of
            Warcraft and Blizzard Entertainment are trademarks or registered
            trademarks of Blizzard Entertainment, Inc.
          </Typography>
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={{ m: 0, ml: { sm: "auto" }, whiteSpace: "nowrap" }}
          >
            Data: Blizzard Game Data API
            {APP_VERSION ? ` · v${APP_VERSION}` : null}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
