import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export function usePaginatedRows<T>(rows: T[], pageSize = DEFAULT_TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, rows.length);

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    return rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [rows, pageSize, safePage]);

  return {
    page: safePage,
    pageRows,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    setPage
  };
}

interface TablePaginationProps {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  labels: {
    showing: string;
    of: string;
    previous: string;
    next: string;
  };
}

export default function TablePagination({
  totalCount,
  page,
  pageSize,
  totalPages,
  startIndex,
  endIndex,
  onPageChange,
  labels
}: TablePaginationProps) {
  if (totalCount <= pageSize) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">
        {labels.showing} {startIndex}-{endIndex} {labels.of} {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={14} className="mr-1" />
          {labels.previous}
        </button>
        <span className="min-w-[4.5rem] text-center text-xs font-extrabold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {labels.next}
          <ChevronRight size={14} className="ml-1" />
        </button>
      </div>
    </div>
  );
}
