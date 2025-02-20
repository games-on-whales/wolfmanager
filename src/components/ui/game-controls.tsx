"use client";

const GLYPHS = {
  arrowLeft: [
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ],
  arrowRight: [
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  mouse: [
    [0, 1, 1, 0],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [0, 1, 1, 0],
  ],
  close: [
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [1, 0, 0, 1],
  ],
};

interface ControlGlyphProps {
  type: keyof typeof GLYPHS;
  color?: string;
  size?: number;
  className?: string;
}

export function ControlGlyph({
  type,
  color = "#fff",
  size = 12,
  className = "",
}: ControlGlyphProps) {
  const glyph = GLYPHS[type];
  const pixelSize = size / glyph[0].length;

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {glyph.map((row, i) =>
          row.map((pixel, j) => {
            if (!pixel) return null;
            return (
              <rect
                key={`${i}-${j}`}
                x={j * pixelSize}
                y={i * pixelSize}
                width={pixelSize}
                height={pixelSize}
                fill={color}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export function GameControls() {
  return (
    <div className="flex items-center gap-4 text-muted-foreground">
      <div className="flex items-center gap-2">
        <ControlGlyph type="arrowLeft" className="opacity-80" />
        <ControlGlyph type="arrowRight" className="opacity-80" />
        <span className="mx-1">or</span>
        <ControlGlyph type="mouse" className="opacity-80" />
      </div>
      <div className="w-px h-4 bg-muted-foreground/20" />
      <div className="flex items-center gap-2">Auto-fire enabled</div>
      <div className="w-px h-4 bg-muted-foreground/20" />
      <div className="flex items-center gap-2">
        <ControlGlyph type="close" className="opacity-80" size={10} />
        <span>Logo to close</span>
      </div>
    </div>
  );
}
