import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type {
  ApiEndpointDefinition,
  ApiEndpointParameter,
} from "@/features/apiExplorer/types";
import { isIdParameter } from "@/features/apiExplorer/workbench/useEndpointRequest";

export type EndpointFormProps = {
  endpoint: ApiEndpointDefinition;
  /** Applied values (URL or parent state); the draft resyncs when they change. */
  values: Record<string, string>;
  /** What "Reset to default" restores (curated → discovered → sample). */
  defaults: Record<string, string>;
  /** Called with the trimmed draft on Enter or the submit button; never per keystroke. */
  onSubmit: (values: Record<string, string>) => void;
  submitLabel?: string;
  /** Prefix for field ids so several forms can share a page. */
  idPrefix: string;
};

const DIGITS_ONLY = /^\d+$/;

const stableKey = (record: Record<string, string>): string =>
  JSON.stringify(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]),
  );

const draftFor = (
  parameters: ApiEndpointParameter[],
  values: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    parameters.map((parameter) => [parameter.key, values[parameter.key] ?? ""]),
  );

const validateParameter = (
  parameter: ApiEndpointParameter,
  value: string,
): string | undefined => {
  const trimmed = value.trim();

  if (parameter.location === "path" && trimmed.length === 0) {
    return `${parameter.label} is required.`;
  }

  if (trimmed.length > 0 && isIdParameter(parameter.key) && !DIGITS_ONLY.test(trimmed)) {
    return `${parameter.label} must be a number.`;
  }

  return undefined;
};

/**
 * Parameter form for one endpoint. Typing only edits the local draft; the
 * request is sent when the form is submitted (Enter or the button).
 */
const EndpointForm = ({
  endpoint,
  values,
  defaults,
  onSubmit,
  submitLabel = "Send request",
  idPrefix,
}: EndpointFormProps): JSX.Element => {
  const parameters = endpoint.parameters ?? [];
  const valuesKey = stableKey(values);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const [draft, setDraft] = useState<Record<string, string>>(() =>
    draftFor(parameters, values),
  );
  const [attempted, setAttempted] = useState(false);

  // Resync from the applied values (URL navigation, reload, another form).
  // `valuesKey` is a stable serialisation, so an equal record is a no-op.
  useEffect(() => {
    setDraft(draftFor(endpoint.parameters ?? [], valuesRef.current));
    setAttempted(false);
  }, [valuesKey, endpoint]);

  const errors = useMemo(
    () =>
      Object.fromEntries(
        parameters.map((parameter) => [
          parameter.key,
          validateParameter(parameter, draft[parameter.key] ?? ""),
        ]),
      ) as Record<string, string | undefined>,
    [draft, parameters],
  );

  const isValid = parameters.every((parameter) => !errors[parameter.key]);
  const isDirty = parameters.some(
    (parameter) =>
      (draft[parameter.key] ?? "") !== (defaults[parameter.key] ?? ""),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setAttempted(true);
    if (!isValid) {
      return;
    }
    onSubmit(
      Object.fromEntries(
        parameters.map((parameter) => [
          parameter.key,
          (draft[parameter.key] ?? "").trim(),
        ]),
      ),
    );
  };

  const resetField = (key: string): void => {
    setDraft((current) => ({ ...current, [key]: defaults[key] ?? "" }));
  };

  const resetAll = (): void => {
    setDraft(draftFor(parameters, defaults));
    setAttempted(false);
  };

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            ...gridTemplateColumnsSx({ xs: 1, md: 2 }),
          }}
        >
          {parameters.map((parameter) => {
            const value = draft[parameter.key] ?? "";
            const error = errors[parameter.key];
            const showError = attempted && Boolean(error);
            const numeric = isIdParameter(parameter.key);
            const canReset = value !== (defaults[parameter.key] ?? "");

            return (
              <TextField
                key={parameter.key}
                id={`${idPrefix}-${parameter.key}`}
                name={parameter.key}
                size="small"
                fullWidth
                label={parameter.label}
                placeholder={parameter.placeholder}
                value={value}
                required={parameter.location === "path"}
                error={showError}
                helperText={showError ? error : parameter.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [parameter.key]: event.target.value,
                  }))
                }
                slotProps={{
                  htmlInput: {
                    inputMode: numeric ? "numeric" : "text",
                    pattern: numeric ? "[0-9]*" : undefined,
                    autoComplete: "off",
                    spellCheck: false,
                  },
                  input: {
                    endAdornment: canReset ? (
                      <InputAdornment position="end">
                        <Tooltip title="Reset to default">
                          <IconButton
                            size="small"
                            edge="end"
                            aria-label={`Reset ${parameter.label} to default`}
                            onClick={() => resetField(parameter.key)}
                          >
                            <RestartAltRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
            );
          })}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button type="submit" variant="contained" size="small">
            {submitLabel}
          </Button>
          {isDirty ? (
            <Button variant="text" size="small" onClick={resetAll}>
              Reset all
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
};

export default EndpointForm;
