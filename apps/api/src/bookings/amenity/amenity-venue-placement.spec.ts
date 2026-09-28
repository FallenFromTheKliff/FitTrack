import { AmenityRepository } from './amenity.repository';

describe('Amenity venue placement transaction', () => {
  const gymEquipment = {
    update: jest.fn(),
  };
  const amenity = {
    update: jest.fn(),
  };
  const transactionClient = { amenity, gymEquipment };
  const prisma = {
    $transaction: jest.fn(
      (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  };

  let repository: AmenityRepository;

  beforeEach(() => {
    repository = new AmenityRepository(prisma as never);
    jest.clearAllMocks();
    amenity.update.mockResolvedValue({ id: 'amenity-1' });
    gymEquipment.update.mockResolvedValue({ id: 'equipment-1' });
  });

  it('propagates a string destination floor to each linked equipment move', async () => {
    await repository.moveAmenityAndEquipment(
      'amenity-1',
      { floor_id: 'floor-2' } as never,
      [{ id: 'equipment-1', gridColumn: 5, gridRow: 4 }],
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      data: {
        floor_id: 'floor-2',
        grid_column: 5,
        grid_row: 4,
        grid_width: 1,
        grid_height: 1,
        position_x: 32.14,
        position_y: 35,
      },
    });
    expect(amenity.update).toHaveBeenCalledWith({
      where: { id: 'amenity-1' },
      data: { floor_id: 'floor-2' },
    });
  });

  it('preserves the current equipment floor when no destination floor is supplied', async () => {
    await repository.moveAmenityAndEquipment(
      'amenity-1',
      { grid_column: 7 } as never,
      [{ id: 'equipment-1', gridColumn: 7, gridRow: 3 }],
    );

    expect(gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      data: {
        grid_column: 7,
        grid_row: 3,
        grid_width: 1,
        grid_height: 1,
        position_x: 46.43,
        position_y: 25,
      },
    });
  });
});
