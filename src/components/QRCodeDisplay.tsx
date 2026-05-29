import React, { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCodeLib = require("qrcode-terminal/vendor/QRCode");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");

function generateMatrix(data: string): boolean[][] {
  try {
    const qr = new QRCodeLib(-1, QRErrorCorrectLevel.M);
    qr.addData(data);
    qr.make();
    return qr.modules as boolean[][];
  } catch {
    return [];
  }
}

interface Props {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export function QRCodeDisplay({
  value,
  size = 200,
  color = "#000000",
  backgroundColor = "#FFFFFF",
}: Props) {
  const matrix = useMemo(() => generateMatrix(value), [value]);

  if (!matrix.length) return null;

  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  const rects: React.ReactElement[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row][col]) {
        rects.push(
          <Rect
            key={`${row}-${col}`}
            x={col * cellSize}
            y={row * cellSize}
            width={cellSize}
            height={cellSize}
            fill={color}
          />
        );
      }
    }
  }

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
      {rects}
    </Svg>
  );
}
