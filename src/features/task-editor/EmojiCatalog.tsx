import { useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Armchair, BusFront, Cat, Flag, Search, Shapes, Smile, Utensils, Volleyball } from "lucide-react";
import ukEmojiData from "emoji-picker-react/dist/data/emojis-uk";

type RawEmoji = { n: string[]; u: string; v?: string[] };
type EmojiItem = { emoji: string; names: string[]; unified: string };
type CategoryKey = "smileys_people" | "animals_nature" | "food_drink" | "travel_places" | "activities" | "objects" | "symbols" | "flags";
type Row = { type: "heading"; category: CategoryKey; title: string } | { type: "emojis"; category: CategoryKey; items: EmojiItem[] };

const categoryConfig: Array<{ key: CategoryKey; title: string; Icon: ComponentType<{ "aria-hidden"?: boolean }> }> = [
  { key: "smileys_people", title: "Смайли та люди", Icon: Smile },
  { key: "animals_nature", title: "Тварини та природа", Icon: Cat },
  { key: "food_drink", title: "Їжа та напої", Icon: Utensils },
  { key: "travel_places", title: "Подорожі та місця", Icon: BusFront },
  { key: "activities", title: "Активності", Icon: Volleyball },
  { key: "objects", title: "Предмети", Icon: Armchair },
  { key: "symbols", title: "Символи", Icon: Shapes },
  { key: "flags", title: "Прапори", Icon: Flag },
];

const HEADING_HEIGHT = 36;
const EMOJI_ROW_HEIGHT = 42;
const OVERSCAN = 4;

function unifiedToEmoji(unified: string) {
  return unified.split("-").map((point) => String.fromCodePoint(Number.parseInt(point, 16))).join("");
}

function expandEmoji(item: RawEmoji): EmojiItem[] {
  return [item.u, ...(item.v ?? [])].map((unified) => ({ emoji: unifiedToEmoji(unified), names: item.n, unified }));
}

function rowHeight(row: Row) {
  return row.type === "heading" ? HEADING_HEIGHT : EMOJI_ROW_HEIGHT;
}

export default function EmojiCatalog({ onSelect }: { onSelect: (emoji: string) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("uk"));
  const [columns, setColumns] = useState(8);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(330);

  const categories = useMemo(() => categoryConfig.map(({ key, title }) => {
    const raw = (ukEmojiData.emojis[key] ?? []) as RawEmoji[];
    return { key, title, items: raw.flatMap(expandEmoji) };
  }), []);

  const rows = useMemo(() => {
    const nextRows: Row[] = [];
    for (const category of categories) {
      const items = deferredQuery ? category.items.filter((item) => item.names.some((name) => name.toLocaleLowerCase("uk").includes(deferredQuery))) : category.items;
      if (!items.length) continue;
      nextRows.push({ type: "heading", category: category.key, title: category.title });
      for (let index = 0; index < items.length; index += columns) nextRows.push({ type: "emojis", category: category.key, items: items.slice(index, index + columns) });
    }
    return nextRows;
  }, [categories, columns, deferredQuery]);

  const layout = useMemo(() => {
    const offsets: number[] = [];
    const categoryOffsets = new Map<CategoryKey, number>();
    let total = 0;
    rows.forEach((row, index) => {
      offsets[index] = total;
      if (row.type === "heading" && !categoryOffsets.has(row.category)) categoryOffsets.set(row.category, total);
      total += rowHeight(row);
    });
    return { offsets, categoryOffsets, total };
  }, [rows]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      setColumns(Math.max(6, Math.min(10, Math.floor((viewport.clientWidth - 14) / 40))));
      setViewportHeight(viewport.clientHeight);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (viewportRef.current) viewportRef.current.scrollTop = 0; setScrollTop(0); }, [deferredQuery, columns]);
  useEffect(() => () => { if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current); }, []);

  let first = 0;
  while (first < rows.length && layout.offsets[first] + rowHeight(rows[first]) < scrollTop) first++;
  first = Math.max(0, first - OVERSCAN);
  let last = first;
  const visibleBottom = scrollTop + viewportHeight;
  while (last < rows.length && layout.offsets[last] < visibleBottom) last++;
  last = Math.min(rows.length, last + OVERSCAN);
  const visibleRows = rows.slice(first, last);

  const handleScroll = () => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setScrollTop(viewportRef.current?.scrollTop ?? 0);
    });
  };

  const jumpToCategory = (category: CategoryKey) => {
    const top = layout.categoryOffsets.get(category);
    if (top === undefined || !viewportRef.current) return;
    viewportRef.current.scrollTo({ top, behavior: "smooth" });
  };

  return <div className="emoji-catalog fast-emoji-catalog" aria-label="Каталог усіх емоджі">
    <label className="emoji-search"><Search aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук емоджі" aria-label="Пошук емоджі"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Очистити пошук">×</button>}</label>
    <nav className="emoji-categories" aria-label="Категорії емоджі">{categoryConfig.map(({ key, title, Icon }) => <button key={key} type="button" title={title} aria-label={title} onClick={() => jumpToCategory(key)}><Icon aria-hidden={true}/></button>)}</nav>
    <div ref={viewportRef} className="emoji-viewport" onScroll={handleScroll}>
      <div className="emoji-virtual-space" style={{ height: layout.total }}>
        {visibleRows.map((row, visibleIndex) => {
          const rowIndex = first + visibleIndex;
          const style = { transform: `translateY(${layout.offsets[rowIndex]}px)`, height: rowHeight(row) };
          if (row.type === "heading") return <div className="emoji-category-title" key={`${row.category}-heading`} style={style}>{deferredQuery ? `Результати · ${row.title}` : row.title}</div>;
          return <div className="emoji-virtual-row" key={`${row.category}-${layout.offsets[rowIndex]}`} style={{ ...style, gridTemplateColumns: `repeat(${columns}, 1fr)` }}>{row.items.map((item) => <button key={item.unified} type="button" title={item.names[0]} aria-label={item.names[0]} onClick={() => onSelect(item.emoji)}>{item.emoji}</button>)}</div>;
        })}
      </div>
      {!rows.length && <div className="emoji-empty">Нічого не знайдено</div>}
    </div>
  </div>;
}
