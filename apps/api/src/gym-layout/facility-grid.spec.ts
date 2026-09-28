import {
  cellKey,
  dedupeCells,
  doRectanglesOverlap,
  expandRectangleToCells,
  findRouteAcrossPathCells,
  getCellBounds,
  getVenueRouteTargets,
  isRectangleInsideFootprint,
  parseCellKey,
} from '../../../../packages/utils/facility-grid';

describe('facility grid geometry', () => {
  const full = expandRectangleToCells({
    gridColumn: 1,
    gridRow: 1,
    gridWidth: 14,
    gridHeight: 10,
  });

  it('normalizes cell keys and deterministically deduplicates', () => {
    expect(cellKey({ column: 2, row: 3 })).toBe('2:3');
    expect(parseCellKey('2:3')).toEqual({ column: 2, row: 3 });
    expect(parseCellKey('15:1')).toEqual({ column: 15, row: 1 });
    expect(parseCellKey('1001:1')).toBeNull();
    expect(
      dedupeCells([
        { column: 2, row: 1 },
        { column: 2, row: 1 },
        { column: 1, row: 1 },
      ]),
    ).toEqual([
      { column: 1, row: 1 },
      { column: 2, row: 1 },
    ]);
  });

  it('expands rectangles, derives bounds, containment, and overlap', () => {
    const rect = { gridColumn: 2, gridRow: 3, gridWidth: 2, gridHeight: 2 };
    expect(expandRectangleToCells(rect)).toHaveLength(4);
    expect(getCellBounds(expandRectangleToCells(rect))).toEqual({
      column: 2,
      row: 3,
      width: 2,
      height: 2,
    });
    expect(isRectangleInsideFootprint(rect, full)).toBe(true);
    expect(
      doRectanglesOverlap(rect, {
        gridColumn: 3,
        gridRow: 4,
        gridWidth: 2,
        gridHeight: 2,
      }),
    ).toBe(true);
  });

  it('contains regions in sparse footprint cells beyond the legacy floor', () => {
    const sparseFootprint = expandRectangleToCells({
      gridColumn: 15,
      gridRow: 11,
      gridWidth: 3,
      gridHeight: 2,
    });
    expect(
      isRectangleInsideFootprint(
        { gridColumn: 16, gridRow: 11, gridWidth: 2, gridHeight: 2 },
        sparseFootprint,
      ),
    ).toBe(true);
  });

  it('finds the shortest route across multiple entries and fails closed without a route', () => {
    const paths = [1, 2, 3, 4, 5].map((column) => ({ column, row: 2 }));
    expect(
      findRouteAcrossPathCells({
        entryCells: [
          { column: 1, row: 2 },
          { column: 4, row: 2 },
        ],
        pathCells: paths,
        targetCells: [{ column: 5, row: 2 }],
      }),
    ).toEqual([
      { column: 4, row: 2 },
      { column: 5, row: 2 },
    ]);
    expect(
      findRouteAcrossPathCells({
        entryCells: [{ column: 1, row: 1 }],
        pathCells: [],
        targetCells: [{ column: 2, row: 2 }],
      }),
    ).toBeNull();
    expect(
      getVenueRouteTargets(
        { gridColumn: 6, gridRow: 2, gridWidth: 2, gridHeight: 2 },
        paths,
      ),
    ).toEqual([{ column: 5, row: 2 }]);
  });
});
