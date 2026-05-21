import { Position } from "@xyflow/react";
import type { HandleSide } from "../model/types";

export const SIDE_TO_POSITION: Record<HandleSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};
