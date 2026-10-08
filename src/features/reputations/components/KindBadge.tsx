import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material";

import { kindColor } from "@/features/reputations/services/reputationPalette";
import { KIND_LABEL } from "@/features/reputations/services/reputationService";
import type { LadderKind } from "@/features/reputations/types";

export const KindIcon = ({
  kind,
  ...props
}: SvgIconProps & { kind: LadderKind }): JSX.Element => {
  switch (kind) {
    case "standard":
      return <MilitaryTechRoundedIcon {...props} />;
    case "friendship":
      return <HandshakeRoundedIcon {...props} />;
    case "renown":
      return <WorkspacePremiumRoundedIcon {...props} />;
    case "group":
      return <AccountTreeRoundedIcon {...props} />;
    default:
      return <HorizontalRuleRoundedIcon {...props} />;
  }
};

export type KindBadgeProps = {
  kind: LadderKind;
  id?: string;
};

/**
 * Standard / Friendship / Renown / Group, as an outlined chip in the kind's
 * colour. The label is the text; the icon and colour only repeat it.
 */
const KindBadge = ({ kind, id }: KindBadgeProps): JSX.Element => (
  <Chip
    id={id}
    size="small"
    variant="outlined"
    icon={<KindIcon kind={kind} />}
    label={KIND_LABEL[kind]}
    sx={(theme) => {
      const color = kindColor(theme, kind);
      return {
        borderColor: alpha(color, 0.5),
        backgroundColor: alpha(theme.palette.surface.base, 0.72),
        color: theme.palette.text.primary,
        "& .MuiChip-icon": { color },
      };
    }}
  />
);

export default KindBadge;
