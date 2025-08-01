import { DataTable } from "@/src/components/table/data-table";
import TableLink from "@/src/components/table/table-link";
import { api } from "@/src/utils/api";
import { type RouterOutput } from "@/src/utils/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useQueryParams, withDefault, NumberParam } from "use-query-params";
import { Archive, ListTree, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { type DatasetItem, DatasetStatus, type Prisma } from "@langfuse/shared";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import { useDetailPageLists } from "@/src/features/navigate-detail-pages/context";
import { useEffect, useState } from "react";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import { useRowHeightLocalStorage } from "@/src/components/table/data-table-row-height-switch";
import { IOTableCell } from "@/src/components/ui/CodeJsonViewer";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import useColumnOrder from "@/src/features/column-visibility/hooks/useColumnOrder";
import { StatusBadge } from "@/src/components/layouts/status-badge";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { type CsvPreviewResult } from "@/src/features/datasets/lib/csvHelpers";
import { PreviewCsvImport } from "@/src/features/datasets/components/PreviewCsvImport";
import { UploadDatasetCsv } from "@/src/features/datasets/components/UploadDatasetCsv";
import { LocalIsoDate } from "@/src/components/LocalIsoDate";
import { BatchExportTableButton } from "@/src/components/BatchExportTableButton";
import { BatchExportTableName } from "@langfuse/shared";

type RowData = {
  id: string;
  source?: {
    traceId: string;
    observationId?: string;
  };
  status: DatasetItem["status"];
  createdAt: Date;
  input: Prisma.JsonValue;
  expectedOutput: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
};

export function DatasetItemsTable({
  projectId,
  datasetId,
  menuItems,
}: {
  projectId: string;
  datasetId: string;
  menuItems?: React.ReactNode;
}) {
  const { setDetailPageList } = useDetailPageLists();
  const utils = api.useUtils();
  const capture = usePostHogClientCapture();
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [paginationState, setPaginationState] = useQueryParams({
    pageIndex: withDefault(NumberParam, 0),
    pageSize: withDefault(NumberParam, 50),
  });

  const [rowHeight, setRowHeight] = useRowHeightLocalStorage(
    "datasetItems",
    "s",
  );

  const hasAccess = useHasProjectAccess({ projectId, scope: "datasets:CUD" });

  const items = api.datasets.itemsByDatasetId.useQuery({
    projectId,
    datasetId,
    page: paginationState.pageIndex,
    limit: paginationState.pageSize,
  });

  useEffect(() => {
    if (items.isSuccess) {
      setDetailPageList(
        "datasetItems",
        items.data.datasetItems.map((t) => ({ id: t.id })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.isSuccess, items.data]);

  const mutUpdate = api.datasets.updateDatasetItem.useMutation({
    onSuccess: () => utils.datasets.invalidate(),
  });

  const mutDelete = api.datasets.deleteDatasetItem.useMutation({
    onSuccess: () => utils.datasets.invalidate(),
  });

  const columns: LangfuseColumnDef<RowData>[] = [
    {
      accessorKey: "id",
      header: "Item id",
      id: "id",
      size: 90,
      isPinned: true,
      cell: ({ row }) => {
        const id: string = row.getValue("id");
        return (
          <TableLink
            path={`/project/${projectId}/datasets/${datasetId}/items/${id}`}
            value={id}
          />
        );
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      headerTooltip: {
        description:
          "Link to the source trace based on which this item was added",
      },
      id: "source",
      size: 90,
      cell: ({ row }) => {
        const source: RowData["source"] = row.getValue("source");
        if (!source) return null;
        return source.observationId ? (
          <TableLink
            path={`/project/${projectId}/traces/${encodeURIComponent(source.traceId)}?observation=${encodeURIComponent(source.observationId)}`}
            value={source.observationId}
            icon={<ListTree className="h-4 w-4" />}
          />
        ) : (
          <TableLink
            path={`/project/${projectId}/traces/${encodeURIComponent(source.traceId)}`}
            value={source.traceId}
            icon={<ListTree className="h-4 w-4" />}
          />
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      id: "status",
      size: 80,
      cell: ({ row }) => {
        const status: DatasetStatus = row.getValue("status");
        return (
          <StatusBadge
            className="capitalize"
            type={status.toLowerCase()}
            isLive={false}
          />
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      id: "createdAt",
      size: 150,
      enableHiding: true,
      cell: ({ row }) => {
        const value: RowData["createdAt"] = row.getValue("createdAt");
        return <LocalIsoDate date={value} />;
      },
    },
    {
      accessorKey: "input",
      header: "Input",
      id: "input",
      size: 200,
      enableHiding: true,
      cell: ({ row }) => {
        const input = row.getValue("input") as RowData["input"];
        return input !== null ? (
          <IOTableCell data={input} singleLine={rowHeight === "s"} />
        ) : null;
      },
    },
    {
      accessorKey: "expectedOutput",
      header: "Expected Output",
      id: "expectedOutput",
      size: 200,
      enableHiding: true,
      cell: ({ row }) => {
        const expectedOutput = row.getValue(
          "expectedOutput",
        ) as RowData["expectedOutput"];
        return expectedOutput !== null ? (
          <IOTableCell
            data={expectedOutput}
            className="bg-accent-light-green"
            singleLine={rowHeight === "s"}
          />
        ) : null;
      },
    },
    {
      accessorKey: "metadata",
      header: "Metadata",
      id: "metadata",
      size: 200,
      enableHiding: true,
      cell: ({ row }) => {
        const metadata = row.getValue("metadata") as RowData["metadata"];
        return metadata !== null ? (
          <IOTableCell data={metadata} singleLine={rowHeight === "s"} />
        ) : null;
      },
    },
    {
      id: "actions",
      accessorKey: "actions",
      header: "Actions",
      size: 70,
      cell: ({ row }) => {
        const id: string = row.getValue("id");
        const status: DatasetStatus = row.getValue("status");
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only [position:relative]">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!hasAccess}
                onClick={() => {
                  capture("dataset_item:archive_toggle", {
                    status:
                      status === DatasetStatus.ARCHIVED
                        ? "unarchived"
                        : "archived",
                  });
                  mutUpdate.mutate({
                    projectId: projectId,
                    datasetId: datasetId,
                    datasetItemId: id,
                    status:
                      status === DatasetStatus.ARCHIVED
                        ? DatasetStatus.ACTIVE
                        : DatasetStatus.ARCHIVED,
                  });
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                {status === DatasetStatus.ARCHIVED ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasAccess}
                className="text-destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this item? This will also delete all run items that belong to this item.",
                    )
                  ) {
                    capture("dataset_item:delete");
                    mutDelete.mutate({
                      projectId: projectId,
                      datasetId: datasetId,
                      datasetItemId: id,
                    });
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const convertToTableRow = (
    item: RouterOutput["datasets"]["itemsByDatasetId"]["datasetItems"][number],
  ): RowData => {
    return {
      id: item.id,
      source: item.sourceTraceId
        ? {
            traceId: item.sourceTraceId,
            observationId: item.sourceObservationId ?? undefined,
          }
        : undefined,
      status: item.status,
      createdAt: item.createdAt,
      input: item.input,
      expectedOutput: item.expectedOutput,
      metadata: item.metadata,
    };
  };

  const [columnVisibility, setColumnVisibility] = useColumnVisibility<RowData>(
    "datasetItemsColumnVisibility",
    columns,
  );

  const [columnOrder, setColumnOrder] = useColumnOrder<RowData>(
    "datasetItemsColumnOrder",
    columns,
  );

  const batchExportButton = (
    <BatchExportTableButton
      key="batchExport"
      projectId={projectId}
      tableName={BatchExportTableName.DatasetItems}
      orderByState={{ column: "createdAt", order: "DESC" }}
      filterState={[
        {
          type: "string",
          operator: "=",
          column: "datasetId",
          value: datasetId,
        },
      ]}
    />
  );

  if (items.data?.totalDatasetItems === 0 && hasAccess) {
    return (
      <>
        <DataTableToolbar
          columns={columns}
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
          columnOrder={columnOrder}
          setColumnOrder={setColumnOrder}
          rowHeight={rowHeight}
          setRowHeight={setRowHeight}
          actionButtons={[menuItems, batchExportButton].filter(Boolean)}
        />
        {preview ? (
          <PreviewCsvImport
            preview={preview}
            csvFile={csvFile}
            projectId={projectId}
            datasetId={datasetId}
            setCsvFile={setCsvFile}
            setPreview={setPreview}
          />
        ) : (
          <UploadDatasetCsv setPreview={setPreview} setCsvFile={setCsvFile} />
        )}
      </>
    );
  }

  return (
    <>
      <DataTableToolbar
        columns={columns}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        rowHeight={rowHeight}
        setRowHeight={setRowHeight}
        actionButtons={[menuItems, batchExportButton].filter(Boolean)}
      />
      <DataTable
        columns={columns}
        data={
          items.isLoading
            ? { isLoading: true, isError: false }
            : items.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: items.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: items.data.datasetItems.map((t) =>
                    convertToTableRow(t),
                  ),
                }
        }
        pagination={{
          totalCount: items.data?.totalDatasetItems ?? null,
          onChange: setPaginationState,
          state: paginationState,
        }}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        rowHeight={rowHeight}
      />
    </>
  );
}
