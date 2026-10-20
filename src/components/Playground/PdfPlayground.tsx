import React, { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Upload,
  FileText,
  Download,
  Copy,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { parsePDFWithDebug, PdfDebugResult, DebugWord, PageDebugData } from './pdfParserDebug';
import { SectionType } from '../../utils/pdfParser';
import styles from './PdfPlayground.module.css';

interface HoverTooltipState {
  word: DebugWord;
  clientX: number;
  clientY: number;
}

interface PdfPlaygroundProps {
  onBack: () => void;
}

const COLUMN_COLORS: Record<string, string> = {
  DATE: '#3b82f6', // blue
  BUSINESS_NAME: '#ec4899', // pink
  INDUSTRY: '#8b5cf6', // purple
  CHARGE_AMOUNT: '#10b981', // green
  ORIGINAL_AMOUNT: '#f59e0b', // amber
  DETAILS: '#06b6d4', // cyan
  IGNORE: '#94a3b8', // gray
};

const formatDateStr = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const PdfPlayground: React.FC<PdfPlaygroundProps> = ({ onBack }) => {
  const [debugResult, setDebugResult] = useState<PdfDebugResult | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return 0.6;
    }
    return 1.25;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'columns' | 'rows' | 'csv'>(
    'transactions',
  );
  const [isBottomCollapsed, setIsBottomCollapsed] = useState<boolean>(false);

  // Overlay layer visibility toggles
  const [showWords, setShowWords] = useState<boolean>(false);
  const [showRows, setShowRows] = useState<boolean>(false);
  const [showColumns, setShowColumns] = useState<boolean>(false);
  const [showBands, setShowBands] = useState<boolean>(true);
  const [onlyTxWords, setOnlyTxWords] = useState<boolean>(false);

  // Hover state
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPdfData = async (buffer: ArrayBuffer, name: string) => {
    setIsLoading(true);
    try {
      const result = await parsePDFWithDebug(buffer);
      setDebugResult(result);
      setFileName(name);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to parse PDF:', err);
      alert('Error parsing PDF. See console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await loadPdfData(buffer, file.name);
  };

  // Render active page on canvas
  const activePageData: PageDebugData | undefined = debugResult?.pages[currentPage - 1];

  useEffect(() => {
    if (!debugResult || !canvasRef.current) return;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await debugResult.doc.getPage(currentPage);
        if (isCancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.direction = 'ltr';

        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('Canvas render error:', err);
        }
      }
    };

    void render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [debugResult, currentPage, scale]);

  const canvasWidth = activePageData ? activePageData.pageWidth * scale : 600;
  const canvasHeight = activePageData ? activePageData.pageHeight * scale : 800;

  const displayTables = useMemo(() => {
    if (!activePageData) return [];
    if (activePageData.tables && activePageData.tables.length > 0) {
      return activePageData.tables;
    }
    if (activePageData.boundaries && activePageData.boundaries.length > 0) {
      return [
        {
          id: `page-${currentPage}-fallback`,
          section: activePageData.section,
          headerY: activePageData.pageHeight,
          topY: activePageData.pageHeight,
          bottomY: 0,
          boundaries: activePageData.boundaries,
        },
      ];
    }
    return [];
  }, [activePageData, currentPage]);

  // Filtered words based on toggle
  const displayedWords = useMemo(() => {
    if (!activePageData) return [];
    if (!onlyTxWords) return activePageData.words;
    return activePageData.words.filter((w) => Boolean(w.assignedColumn));
  }, [activePageData, onlyTxWords]);

  // CSV output string
  const generatedCsvString = useMemo(() => {
    if (!debugResult) return '';
    const headers = 'Date,Business Name,Industry,Original Amount,Debit Amount,Details';
    const rows = debugResult.transactions.map((t) => {
      const d = formatDateStr(t.date);
      const origAmt = t.originalAmount ? `"${t.originalAmount}"` : '""';
      return `${d},"${t.businessName}","${t.industry}",${origAmt},${t.debitAmount},"${t.details}"`;
    });
    return [headers, ...rows].join('\n');
  }, [debugResult]);

  const copyCsvToClipboard = () => {
    void navigator.clipboard.writeText(generatedCsvString);
    alert('CSV copied to clipboard!');
  };

  const downloadCsv = () => {
    const blob = new Blob([generatedCsvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = fileName ? fileName.replace(/\.pdf$/i, '') : 'parsed';
    link.setAttribute('download', `${cleanName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((p) => Math.min(debugResult?.totalPages ?? 1, p + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugResult?.totalPages]);

  return (
    <div dir="ltr" className={styles.playgroundContainer}>
      {/* Top Header Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.backButton}`}
            onClick={onBack}
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
            <span className={styles.backButtonTextDesktop}>Back to Dashboard</span>
          </button>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>
              <span className={styles.titleDesktop}>PDF Parser Playground</span>
              <span className={styles.titleMobile}>PDF Playground</span>
            </h1>
            {fileName && (
              <span className={`${styles.sectionBadge} ${styles.badgeDesktop}`} title={fileName}>
                {fileName}
              </span>
            )}
          </div>
        </div>

        <div className={styles.topBarRight}>
          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              void handleFileUpload(e);
            }}
          />
          <button
            type="button"
            className={styles.actionButtonPrimary}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload PDF"
            title="Upload PDF"
          >
            <Upload size={16} />
            <span className={styles.uploadTextDesktop}>Upload PDF</span>
            <span className={styles.uploadTextMobile}>Upload</span>
          </button>
        </div>
      </header>

      {/* Controls & Layers Toolbar */}
      <div className={styles.toolbar}>
        {/* Zoom */}
        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
            aria-label="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className={styles.pageIndicator}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.25).toFixed(2))))}
            aria-label="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Overlay Layer Toggles */}
        <div className={`${styles.toolbarGroup} ${styles.layerToggles}`}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showWords}
              onChange={(e) => setShowWords(e.target.checked)}
            />
            <span className={`${styles.colorDot} ${styles.dotRed}`} />
            <span>Text Clusters</span>
          </label>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showRows}
              onChange={(e) => setShowRows(e.target.checked)}
            />
            <span className={`${styles.colorDot} ${styles.dotBlue}`} />
            <span>Rows (Horizontal)</span>
          </label>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showColumns}
              onChange={(e) => setShowColumns(e.target.checked)}
            />
            <span className={`${styles.colorDot} ${styles.dotGreen}`} />
            <span>Columns (Vertical)</span>
          </label>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showBands}
              onChange={(e) => setShowBands(e.target.checked)}
            />
            <span className={`${styles.colorDot} ${styles.dotYellow}`} />
            <span>Column Bands</span>
          </label>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={onlyTxWords}
              onChange={(e) => setOnlyTxWords(e.target.checked)}
            />
            <span>Tx Words Only</span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainLayout}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <span>Parsing PDF and extracting layout metrics...</span>
          </div>
        )}

        {!isLoading && !debugResult && (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <h2>No PDF loaded</h2>
            <p>
              Upload a PDF statement to visualize detected text clusters, rows, and column
              boundaries.
            </p>
            <button
              type="button"
              className={styles.actionButtonPrimary}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>Upload PDF</span>
            </button>
          </div>
        )}

        {!isLoading && debugResult && activePageData && (
          <div className={styles.canvasContainerWrapper}>
            <div className={styles.canvasScrollContainer}>
              <div
                dir="ltr"
                className={styles.canvasWrapper}
                style={{ width: canvasWidth, height: canvasHeight }}
              >
                <canvas ref={canvasRef} dir="ltr" className={styles.pdfCanvas} />

                {/* SVG Visual Overlay */}
                <svg
                  key={`svg-overlay-page-${currentPage}`}
                  className={styles.svgOverlay}
                  width={canvasWidth}
                  height={canvasHeight}
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                >
                  {/* 1. Column Boundary Bands (Shaded background regions) */}
                  {showBands &&
                    displayTables.map((table, tIdx) => (
                      <g key={`table-bands-${currentPage}-${table.id ?? tIdx}`}>
                        {table.boundaries.map((b, bIdx) => {
                          const vxMin = Math.max(0, b.minX * scale);
                          const vxMax = Math.min(canvasWidth, b.maxX * scale);
                          const vyTop =
                            b.topY !== undefined
                              ? Math.max(0, (activePageData.pageHeight - b.topY) * scale)
                              : 0;
                          const vyBottom =
                            b.bottomY !== undefined
                              ? Math.min(
                                  canvasHeight,
                                  (activePageData.pageHeight - b.bottomY) * scale,
                                )
                              : canvasHeight;
                          const tableHeight = Math.max(20, vyBottom - vyTop);
                          const color = COLUMN_COLORS[b.goal] ?? '#64748b';
                          return (
                            <g key={`band-${currentPage}-${table.id ?? tIdx}-${b.goal}-${bIdx}`}>
                              <rect
                                x={vxMin}
                                y={vyTop}
                                width={Math.max(0, vxMax - vxMin)}
                                height={tableHeight}
                                fill={color}
                                fillOpacity={0.08}
                              />
                              {/* Header label banner placed directly above the table header */}
                              <rect
                                x={vxMin + 2}
                                y={Math.max(2, vyTop - 22)}
                                width={Math.max(10, vxMax - vxMin - 4)}
                                height={20}
                                fill={color}
                                fillOpacity={0.3}
                                rx={3}
                              />
                              <text
                                x={(vxMin + vxMax) / 2}
                                y={Math.max(16, vyTop - 8)}
                                textAnchor="middle"
                                fill={color}
                                fontSize={10}
                                fontWeight="bold"
                              >
                                {b.goal}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    ))}

                  {/* 2. Column Vertical Boundary Lines */}
                  {showColumns &&
                    displayTables.map((table, tIdx) => (
                      <g key={`table-cols-${currentPage}-${table.id ?? tIdx}`}>
                        {table.boundaries.map((b, bIdx) => {
                          const vxMin = b.minX * scale;
                          const vxMax = b.maxX * scale;
                          const vxAnchor = (b.anchorX ?? b.minX) * scale;
                          const vyTop =
                            b.topY !== undefined
                              ? Math.max(0, (activePageData.pageHeight - b.topY) * scale)
                              : 0;
                          const vyBottom =
                            b.bottomY !== undefined
                              ? Math.min(
                                  canvasHeight,
                                  (activePageData.pageHeight - b.bottomY) * scale,
                                )
                              : canvasHeight;
                          const color = COLUMN_COLORS[b.goal] ?? '#10b981';
                          return (
                            <g
                              key={`col-line-${currentPage}-${table.id ?? tIdx}-${b.goal}-${bIdx}`}
                            >
                              {/* Min boundary */}
                              <line
                                x1={vxMin}
                                y1={Math.max(0, vyTop - 22)}
                                x2={vxMin}
                                y2={vyBottom}
                                stroke={color}
                                strokeWidth={1}
                                strokeDasharray="4 2"
                              />
                              {/* Max boundary */}
                              <line
                                x1={vxMax}
                                y1={Math.max(0, vyTop - 22)}
                                x2={vxMax}
                                y2={vyBottom}
                                stroke={color}
                                strokeWidth={1}
                                strokeDasharray="4 2"
                              />
                              {/* Anchor marker */}
                              {b.anchorX !== undefined && (
                                <circle
                                  cx={vxAnchor}
                                  cy={Math.max(10, vyTop - 11)}
                                  r={3}
                                  fill={color}
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>
                    ))}

                  {/* 3. Horizontal Detected Row Boundaries */}
                  {showRows &&
                    activePageData.rows.map((row, rIdx) => {
                      const vy = (activePageData.pageHeight - row.y) * scale;
                      const isTx = row.type === 'transaction';
                      const isHeader = row.type === 'table_header';
                      const strokeColor = isTx ? '#3b82f6' : isHeader ? '#10b981' : '#cbd5e1';
                      return (
                        <g key={`row-${currentPage}-${row.y}-${rIdx}`}>
                          <line
                            x1={0}
                            y1={vy}
                            x2={canvasWidth}
                            y2={vy}
                            stroke={strokeColor}
                            strokeWidth={isTx || isHeader ? 1 : 0.5}
                            strokeDasharray={isTx ? '2 2' : undefined}
                          />
                          {isTx && (
                            <text
                              x={canvasWidth - 6}
                              y={vy - 3}
                              textAnchor="end"
                              fill="#3b82f6"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              TX
                            </text>
                          )}
                          {isHeader && (
                            <text
                              x={canvasWidth - 6}
                              y={vy - 3}
                              textAnchor="end"
                              fill="#10b981"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              HEADER
                            </text>
                          )}
                        </g>
                      );
                    })}

                  {/* 4. Text Item Bounding Boxes & Hover Tooltip Triggers */}
                  {showWords &&
                    displayedWords.map((word, wIdx) => {
                      const vx = word.x * scale;
                      const vy = (activePageData.pageHeight - word.y) * scale;
                      const vw = word.width * scale;
                      const vh = (word.height || 10) * scale;
                      const colColor = word.assignedColumn
                        ? (COLUMN_COLORS[word.assignedColumn] ?? '#ef4444')
                        : '#ef4444';

                      return (
                        <g
                          key={`word-${currentPage}-${word.x}-${word.y}-${wIdx}`}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            const rect = canvasRef.current?.getBoundingClientRect();
                            setHoverTooltip({
                              word,
                              clientX: e.clientX - (rect?.left ?? 0),
                              clientY: e.clientY - (rect?.top ?? 0),
                            });
                          }}
                          onMouseLeave={() => setHoverTooltip(null)}
                        >
                          <rect
                            x={vx}
                            y={vy - vh}
                            width={vw}
                            height={vh}
                            fill={word.assignedColumn ? colColor : 'transparent'}
                            fillOpacity={word.assignedColumn ? 0.15 : 0}
                            stroke={colColor}
                            strokeWidth={word.assignedColumn ? 1 : 0.5}
                            strokeDasharray={word.assignedColumn ? undefined : '1 1'}
                          />
                        </g>
                      );
                    })}
                </svg>

                {/* Word Details Floating Tooltip */}
                {hoverTooltip && (
                  <div
                    className={styles.tooltipPopup}
                    style={{
                      left: Math.min(canvasWidth - 220, hoverTooltip.clientX + 10),
                      top: Math.max(10, hoverTooltip.clientY - 90),
                    }}
                  >
                    <div className={styles.tooltipWord}>&quot;{hoverTooltip.word.str}&quot;</div>
                    <div className={styles.tooltipRow}>
                      <span>Assigned Col:</span>
                      <strong>{hoverTooltip.word.assignedColumn ?? 'None (Ignored)'}</strong>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span>Coords (PDF):</span>
                      <span>
                        x={hoverTooltip.word.x.toFixed(1)}, y={hoverTooltip.word.y.toFixed(1)}
                      </span>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span>Size:</span>
                      <span>
                        w={hoverTooltip.word.width.toFixed(1)}, h=
                        {(hoverTooltip.word.height ?? 10).toFixed(1)}
                      </span>
                    </div>
                    {hoverTooltip.word.rowY !== undefined && (
                      <div className={styles.tooltipRow}>
                        <span>Row Y:</span>
                        <span>{hoverTooltip.word.rowY.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Floating Page Navigation Pill */}
            <div className={styles.floatingPageNav}>
              <button
                type="button"
                className={styles.pageNavButton}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.floatingPageIndicator}>
                Page {currentPage} of {debugResult.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageNavButton}
                disabled={currentPage >= (debugResult.totalPages ?? 1)}
                onClick={() => setCurrentPage((p) => Math.min(debugResult.totalPages ?? 1, p + 1))}
                aria-label="Next Page"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Drawer Inspector */}
        {debugResult && (
          <div
            className={`${styles.bottomPanel} ${isBottomCollapsed ? styles.bottomPanelCollapsed : ''}`}
          >
            <div className={styles.tabsHeader}>
              <div className={styles.tabsList}>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === 'transactions' ? styles.tabButtonActive : ''}`}
                  onClick={() => {
                    setActiveTab('transactions');
                    setIsBottomCollapsed(false);
                  }}
                >
                  <span>Parsed Transactions</span>
                  <span className={styles.tabBadge}>{debugResult.transactions.length}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === 'columns' ? styles.tabButtonActive : ''}`}
                  onClick={() => {
                    setActiveTab('columns');
                    setIsBottomCollapsed(false);
                  }}
                >
                  <span>Columns &amp; Boundaries</span>
                  <span className={styles.tabBadge}>{activePageData?.boundaries.length ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === 'rows' ? styles.tabButtonActive : ''}`}
                  onClick={() => {
                    setActiveTab('rows');
                    setIsBottomCollapsed(false);
                  }}
                >
                  <span>Detected Rows</span>
                  <span className={styles.tabBadge}>{activePageData?.rows.length ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === 'csv' ? styles.tabButtonActive : ''}`}
                  onClick={() => {
                    setActiveTab('csv');
                    setIsBottomCollapsed(false);
                  }}
                >
                  <span>Export CSV</span>
                </button>
              </div>
              <button
                type="button"
                className={styles.collapseToggleBtn}
                onClick={() => setIsBottomCollapsed((prev) => !prev)}
                aria-label={
                  isBottomCollapsed ? 'Expand inspector panel' : 'Collapse inspector panel'
                }
                title={isBottomCollapsed ? 'Expand inspector panel' : 'Collapse inspector panel'}
              >
                {isBottomCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {!isBottomCollapsed && (
              <div className={styles.tabContent}>
                {/* Tab 1: Transactions */}
                {activeTab === 'transactions' && (
                  <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>תאריך (Date)</th>
                          <th>שם בית העסק (Business Name)</th>
                          <th>ענף (Industry)</th>
                          <th>סכום עסקה (Tx Amount)</th>
                          <th>סכום חיוב (Debit)</th>
                          <th>פירוט (Details)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugResult.transactions.map((tx, idx) => (
                          <tr key={tx.id}>
                            <td>{idx + 1}</td>
                            <td>{formatDateStr(tx.date)}</td>
                            <td>{tx.businessName}</td>
                            <td>{tx.industry}</td>
                            <td>{tx.originalAmount ?? '-'}</td>
                            <td>{tx.debitAmount}</td>
                            <td>{tx.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 2: Column Boundaries */}
                {activeTab === 'columns' && (
                  <div className={styles.tableContainer}>
                    {displayTables.length === 0 ? (
                      <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                        No active tables detected on this page.
                      </div>
                    ) : (
                      displayTables.map((table, tIdx) => (
                        <div
                          key={`tab2-table-${currentPage}-${table.id || tIdx}`}
                          style={{ marginBottom: '1.5rem' }}
                        >
                          <div className={styles.tableSectionHeader}>
                            <span>
                              <strong>
                                Table {tIdx + 1}:{' '}
                                {table.section === SectionType.Foreign
                                  ? 'רכישות בחו"ל (Foreign Purchases)'
                                  : table.section === SectionType.Domestic
                                    ? 'עסקות בארץ (Domestic Purchases)'
                                    : 'Unknown Section'}
                              </strong>
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              Y range: {table.topY.toFixed(1)} to {table.bottomY.toFixed(1)} (Header
                              Y: {table.headerY.toFixed(1)})
                            </span>
                          </div>
                          <table className={styles.dataTable}>
                            <thead>
                              <tr>
                                <th>Goal Name</th>
                                <th>Min X</th>
                                <th>Max X</th>
                                <th>Span Width</th>
                                <th>Anchor (Midpoint)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.boundaries.map((b) => (
                                <tr key={b.goal}>
                                  <td>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: COLUMN_COLORS[b.goal] ?? '#64748b',
                                        marginRight: 6,
                                      }}
                                    />
                                    <strong>{b.goal}</strong>
                                  </td>
                                  <td>{b.minX.toFixed(1)}px</td>
                                  <td>
                                    {b.maxX >= 1500 ? 'End of Page' : `${b.maxX.toFixed(1)}px`}
                                  </td>
                                  <td>
                                    {b.maxX >= 1500
                                      ? '-'
                                      : `${Math.max(0, b.maxX - b.minX).toFixed(1)}px`}
                                  </td>
                                  <td>
                                    {b.anchorX !== undefined ? `${b.anchorX.toFixed(1)}px` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Detected Rows */}
                {activeTab === 'rows' && (
                  <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Y Position</th>
                          <th>Row Classification</th>
                          <th>Raw Line Text</th>
                          <th>Items Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePageData?.rows.map((r, rIdx) => (
                          <tr key={`tab-row-${currentPage}-${r.y}-${rIdx}`}>
                            <td>{rIdx + 1}</td>
                            <td>{r.y.toFixed(1)}px</td>
                            <td>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  backgroundColor:
                                    r.type === 'transaction'
                                      ? '#dbeafe'
                                      : r.type === 'table_header'
                                        ? '#d1fae5'
                                        : r.type === 'section_header'
                                          ? '#fef3c7'
                                          : '#f1f5f9',
                                  color:
                                    r.type === 'transaction'
                                      ? '#1d4ed8'
                                      : r.type === 'table_header'
                                        ? '#047857'
                                        : r.type === 'section_header'
                                          ? '#b45309'
                                          : '#64748b',
                                }}
                              >
                                {r.type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ direction: 'rtl', textAlign: 'right' }}>{r.lineStr}</td>
                            <td>{r.items.length} items</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 4: Export CSV */}
                {activeTab === 'csv' && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <button type="button" className={styles.actionButton} onClick={downloadCsv}>
                        <Download size={14} />
                        <span>Download parsed.csv</span>
                      </button>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={copyCsvToClipboard}
                      >
                        <Copy size={14} />
                        <span>Copy CSV Content</span>
                      </button>
                    </div>
                    <pre className={styles.csvPre}>{generatedCsvString}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfPlayground;
