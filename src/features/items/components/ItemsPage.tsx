import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded"
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import ResultCard from "@/components/common/ResultCard"
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid"
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger"
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow"
import {
  fetchItemClassDetail,
  fetchItemClassIndex,
  fetchItemDetail,
  fetchItemGalleryPage,
  fetchItemMediaUrl,
} from "@/features/items/services/itemService"
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext"
import { SearchResult } from "@/features/search/types"
import { env } from "@/lib/env"
import { BlizzardRequestError } from "@/lib/blizzardClient"

const PAGE_SIZE = 24

const formatPrice = (value: number | undefined): string | undefined => {
  if (typeof value !== "number" || value <= 0) {
    return undefined
  }

  const gold = Math.floor(value / 10000)
  const silver = Math.floor((value % 10000) / 100)
  const copper = value % 100

  return [
    gold > 0 ? `${gold}g` : undefined,
    silver > 0 ? `${silver}s` : undefined,
    copper > 0 ? `${copper}c` : undefined,
  ]
    .filter(Boolean)
    .join(" ")
}

const ItemsPage = (): JSX.Element => {
  const [selectedClassId, setSelectedClassId] = useState<number | "">("")
  const [selectedSubclassId, setSelectedSubclassId] = useState<number | null>(null)
  const [renderedCount, setRenderedCount] = useState(0)
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)

  const classIndexQuery = useQuery({
    queryKey: ["item-class-index", env.region],
    queryFn: fetchItemClassIndex,
  })

  const itemClasses = useMemo(() => classIndexQuery.data?.item_classes ?? [], [classIndexQuery.data])

  useEffect(() => {
    if (selectedClassId === "" && itemClasses.length > 0) {
      setSelectedClassId(itemClasses[0].id)
    }
  }, [itemClasses, selectedClassId])

  const classDetailQuery = useQuery({
    queryKey: ["item-class-detail", selectedClassId, env.region],
    queryFn: () => fetchItemClassDetail(Number(selectedClassId)),
    enabled: selectedClassId !== "",
  })

  const subclasses = useMemo(() => classDetailQuery.data?.item_subclasses ?? [], [classDetailQuery.data])

  useEffect(() => {
    if (selectedSubclassId === null) {
      return
    }

    const hasSelectedSubclass = subclasses.some((entry) => entry.id === selectedSubclassId)
    if (!hasSelectedSubclass) {
      setSelectedSubclassId(null)
    }
  }, [selectedSubclassId, subclasses])

  const galleryQuery = useInfiniteQuery({
    queryKey: ["item-class-gallery", selectedClassId, selectedSubclassId, env.region],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchItemGalleryPage(Number(selectedClassId), pageParam, selectedSubclassId ?? undefined, PAGE_SIZE),
    enabled: selectedClassId !== "",
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined),
  })

  const galleryPages = galleryQuery.data?.pages ?? []
  const loadedItems = useMemo(() => galleryPages.flatMap((pageEntry) => pageEntry.items), [galleryPages])
  const activeMediaCount = useIdlePrefetchWindow({
    totalCount: loadedItems.length,
    initialCount: 12,
    batchSize: 6,
    resetKey: `${selectedClassId}-${selectedSubclassId}-${galleryPages.length}`,
  })

  const itemMediaQueries = useQueries({
    queries: loadedItems.map((item) => ({
      queryKey: ["item-media", item.id, env.region],
      queryFn: () => fetchItemMediaUrl(item.id),
      enabled: loadedItems.findIndex((entry) => entry.id === item.id) < activeMediaCount,
      staleTime: 300000,
      retry: false,
    })),
  })

  const galleryItems = useMemo(
    () =>
      loadedItems.map((item, index) => ({
        ...item,
        mediaUrl: itemMediaQueries[index]?.data,
      })),
    [itemMediaQueries, loadedItems]
  )

  const selectedItemDetailQuery = useQuery({
    queryKey: ["item-detail-dialog", selectedItem?.id, env.region],
    queryFn: () => fetchItemDetail(Number(selectedItem?.id)),
    enabled: selectedItem !== null,
    staleTime: 300000,
    retry: false,
  })

  const friendlyError = useMemo(() => {
    const error = classIndexQuery.error ?? classDetailQuery.error ?? galleryQuery.error
    if (!error) {
      return undefined
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Item API. Update your Blizzard credentials in the .env file and refresh."
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again."
      }
    }

    return error instanceof Error ? error.message : "Unable to load item data right now."
  }, [classDetailQuery.error, classIndexQuery.error, galleryQuery.error])

  const handleClassChange = (event: SelectChangeEvent<number | "">) => {
    const value = event.target.value
    setSelectedClassId(typeof value === "string" ? Number(value) : value)
    setSelectedSubclassId(null)
  }

  const isLoading = classIndexQuery.isLoading || classDetailQuery.isLoading || galleryQuery.isLoading

  const loadMoreItems = useCallback(() => {
    if (!galleryQuery.hasNextPage || galleryQuery.isFetchingNextPage) {
      return
    }

    void galleryQuery.fetchNextPage()
  }, [galleryQuery.fetchNextPage, galleryQuery.hasNextPage, galleryQuery.isFetchingNextPage])

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: selectedClassId !== "" && !friendlyError,
    hasMore: galleryQuery.hasNextPage,
    isLoading: galleryQuery.isFetchingNextPage,
    onLoadMore: loadMoreItems,
  })

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
        id: "items",
        label: "Items",
        renderedCount,
        totalCount: galleryItems.length,
        enrichmentCount: activeMediaCount,
        notes: classDetailQuery.data?.name ?? "Item gallery",
      }
      : null
  )

  const selectedItemDetailRows = useMemo(() => {
    const detail = selectedItemDetailQuery.data
    if (!detail) {
      return []
    }

    return [
      detail.quality ? `Quality: ${detail.quality}` : undefined,
      typeof detail.level === "number" ? `Item level: ${detail.level}` : undefined,
      typeof detail.requiredLevel === "number" ? `Required level: ${detail.requiredLevel}` : undefined,
      detail.itemClass ? `Class: ${detail.itemClass}` : undefined,
      detail.itemSubclass ? `Subclass: ${detail.itemSubclass}` : undefined,
      detail.inventoryType ? `Slot: ${detail.inventoryType}` : undefined,
      detail.binding ? `Binding: ${detail.binding}` : undefined,
      detail.isEquippable ? "Equippable" : undefined,
      typeof detail.maxCount === "number" && detail.maxCount > 0 ? `Max stack: ${detail.maxCount}` : undefined,
      formatPrice(detail.purchasePrice) ? `Purchase price: ${formatPrice(detail.purchasePrice)}` : undefined,
      formatPrice(detail.sellPrice) ? `Sell price: ${formatPrice(detail.sellPrice)}` : undefined,
    ].filter(Boolean) as string[]
  }, [selectedItemDetailQuery.data])

  const selectedItemChipLabels = useMemo(() => {
    const labels = [
      selectedItem?.tag,
      selectedItemDetailQuery.data?.quality,
      selectedItemDetailQuery.data?.inventoryType,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0))

    return labels.filter((label, index) => labels.findIndex((entry) => entry.toLowerCase() === label.toLowerCase()) === index)
  }, [selectedItem, selectedItemDetailQuery.data])

  const selectedItemUsesIconAsset = Boolean(selectedItem?.mediaUrl && /\/icons\/56\//.test(selectedItem.mediaUrl))

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Inventory2RoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Item Archive
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse live item records as a gallery. Filter by class and subclass, then keep scrolling through Blizzard&apos;s item search results while the grid fills itself in.
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          borderColor: "rgba(30, 155, 233, 0.22)",
          backgroundColor: "rgba(12, 18, 34, 0.72)",
        }}
      >
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TuneRoundedIcon color="primary" />
              <Typography variant="subtitle1" color="text.secondary">
                Filter the archive
              </Typography>
            </Stack>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 260 } }}>
              <InputLabel id="item-class-select-label">Item class</InputLabel>
              <Select
                labelId="item-class-select-label"
                value={selectedClassId}
                label="Item class"
                onChange={handleClassChange}
              >
                {itemClasses.map((itemClass) => (
                  <MenuItem key={itemClass.id} value={itemClass.id}>
                    {itemClass.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {subclasses.length > 0 ? (
            <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
              <Chip
                label="All subclasses"
                clickable
                color={selectedSubclassId === null ? "primary" : "default"}
                variant={selectedSubclassId === null ? "filled" : "outlined"}
                onClick={() => setSelectedSubclassId(null)}
                sx={{ borderRadius: 2 }}
              />
              {subclasses.map((subclass) => (
                <Chip
                  key={subclass.id}
                  label={subclass.name}
                  clickable
                  color={selectedSubclassId === subclass.id ? "primary" : "default"}
                  variant={selectedSubclassId === subclass.id ? "filled" : "outlined"}
                  onClick={() => setSelectedSubclassId(subclass.id)}
                  sx={{ borderRadius: 2 }}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {friendlyError ? (
        <Alert severity="error" icon={<ReportProblemRoundedIcon fontSize="small" />} sx={{ borderRadius: 3 }}>
          {friendlyError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
          {Array.from({ length: PAGE_SIZE }).slice(0, 12).map((_, index) => (
            <Grid item xs={1} key={index}>
              <Skeleton
                variant="rounded"
                sx={{
                  height: 220,
                  borderRadius: 3,
                  backgroundColor: "rgba(12, 18, 34, 0.45)",
                }}
              />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {classDetailQuery.data?.name ?? "Selected items"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Loaded {galleryItems.length} items across {galleryPages.length || 1} page{galleryPages.length === 1 ? "" : "s"} from Blizzard&apos;s live item search.
            </Typography>
          </Stack>

          {galleryItems.length > 0 ? (
            <VirtualizedCardGrid
              items={galleryItems}
              getItemKey={(item) => item.id}
              itemHeight={244}
              gap={12}
              columns={{ xs: 1, sm: 2, md: 4, lg: 6, xl: 10 }}
              onVisibleRangeChange={(range) => setRenderedCount(range.end - range.start)}
              renderItem={(item) => <ResultCard result={item} accentColor="#1e9be9" compact onClick={() => setSelectedItem(item)} />}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No items matched the current subclass filter. Try another subclass or switch back to all subclasses.
            </Typography>
          )}

          <Stack spacing={1.5} alignItems="center">
            {galleryQuery.hasNextPage ? (
              <Typography variant="body2" color="text.secondary">
                Keep scrolling to load more items.
              </Typography>
            ) : galleryItems.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Reached the end of the current live item archive slice.
              </Typography>
            ) : null}
            {activeMediaCount < loadedItems.length ? (
              <Typography variant="caption" color="text.secondary">
                Prefetching additional item media during idle time.
              </Typography>
            ) : null}
            {galleryQuery.isFetchingNextPage ? <CircularProgress color="primary" size={28} /> : null}
            {galleryQuery.hasNextPage ? <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} /> : null}
          </Stack>
        </Stack>
      ) : null}

      <Dialog
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {selectedItem?.name ?? "Item details"}
          <IconButton
            aria-label="Close item details"
            onClick={() => setSelectedItem(null)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "stretch", md: "flex-start" }}>
            <Box
              sx={{
                width: selectedItemUsesIconAsset ? { xs: 56, md: 56 } : { xs: "100%", md: 260 },
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: selectedItemUsesIconAsset ? 56 : "100%",
                  height: selectedItemUsesIconAsset ? 56 : "auto",
                  minHeight: selectedItemUsesIconAsset ? 56 : { xs: 220, md: 260 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: selectedItemUsesIconAsset ? 1 : 3,
                  border: selectedItemUsesIconAsset ? "none" : "1px solid rgba(30, 155, 233, 0.16)",
                  backgroundColor: selectedItemUsesIconAsset ? "transparent" : "rgba(7, 12, 24, 0.72)",
                  p: selectedItemUsesIconAsset ? 0 : 3,
                }}
              >
                {selectedItem?.mediaUrl ? (
                  <Box
                    component="img"
                    src={selectedItem.mediaUrl}
                    alt={selectedItem.name}
                    sx={{
                      width: selectedItemUsesIconAsset ? 56 : "auto",
                      height: selectedItemUsesIconAsset ? 56 : "auto",
                      maxWidth: selectedItemUsesIconAsset ? 56 : 180,
                      maxHeight: selectedItemUsesIconAsset ? 56 : 180,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <Typography variant="h2" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    {selectedItem?.name.slice(0, 1)}
                  </Typography>
                )}
              </Box>
            </Box>

            <Stack spacing={3} sx={{ minWidth: 0, flex: 1 }}>
              {selectedItemDetailQuery.isLoading ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    Loading live item details...
                  </Typography>
                </Stack>
              ) : null}

              {selectedItemDetailQuery.isError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {selectedItemDetailQuery.error instanceof Error
                    ? selectedItemDetailQuery.error.message
                    : "Unable to load item details right now."}
                </Alert>
              ) : null}

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedItemChipLabels.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    color={selectedItemDetailQuery.data?.quality?.toLowerCase() === label.toLowerCase() ? "primary" : "default"}
                    variant={selectedItemDetailQuery.data?.quality?.toLowerCase() === label.toLowerCase() ? "outlined" : "filled"}
                  />
                ))}
              </Stack>

              {selectedItem?.summary ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedItem.summary}
                  </Typography>
                </Box>
              ) : null}

              {selectedItemDetailQuery.data?.description || selectedItem?.details ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedItemDetailQuery.data?.description || selectedItem?.details}
                  </Typography>
                </Box>
              ) : null}

              {selectedItemDetailRows.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Item data
                  </Typography>
                  <Stack spacing={0.75}>
                    {selectedItemDetailRows.map((row) => (
                      <Typography key={row} variant="body2" color="text.secondary">
                        {row}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              <Link
                href={selectedItemDetailQuery.data?.href ?? selectedItem?.href}
                target="_blank"
                rel="noreferrer"
                color="primary"
                underline="hover"
                sx={{ alignSelf: "flex-start" }}
              >
                View full record on Blizzard
              </Link>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  )
}

export default ItemsPage