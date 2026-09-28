import {
  mapAmenityToVenueRecord,
  mapVenueMutationPayloadToAmenityPayload,
} from '../../../../../packages/api-client/domains/venue-compat';

describe('venue client media contract', () => {
  it('maps persisted image media fields and safe defaults', () => {
    const mapped = mapAmenityToVenueRecord({
      id: '0f06c18a-1171-4f31-b0b8-47650d276d22',
      image_fit: 'contain',
      image_focal_x: '0.2',
      image_focal_y: '0.8',
      image_crop_zoom: '1.5',
      image_url: 'https://cdn.fittrack.test/studio-primary.jpg',
      image_urls: [
        ' https://cdn.fittrack.test/studio-primary.jpg ',
        'https://cdn.fittrack.test/studio-side.jpg',
        'https://cdn.fittrack.test/studio-side.jpg',
      ],
      name: 'Studio',
      type: 'other',
    });

    expect(mapped).toMatchObject({
      imageFit: 'contain',
      imageFocalX: 0.2,
      imageFocalY: 0.8,
      imageCropZoom: 1.5,
      imageUrl: 'https://cdn.fittrack.test/studio-primary.jpg',
      imageUrls: [
        'https://cdn.fittrack.test/studio-primary.jpg',
        'https://cdn.fittrack.test/studio-side.jpg',
      ],
    });
  });

  it('serializes image media fields without changing venue geometry', () => {
    const payload = mapVenueMutationPayloadToAmenityPayload({
      capacity: 8,
      displayOrder: 2,
      floorId: 'floor-1',
      gridColumn: 3,
      gridHeight: 4,
      gridRow: 2,
      gridWidth: 5,
      iconKey: 'gym-area',
      imageFit: 'cover',
      imageFocalX: 0.4,
      imageFocalY: 0.6,
      imageCropZoom: 2,
      imageUrls: [
        'https://cdn.fittrack.test/strength-front.jpg',
        ' https://cdn.fittrack.test/strength-side.jpg ',
        'https://cdn.fittrack.test/strength-front.jpg',
      ],
      isReservable: false,
      minimumHours: 1,
      name: 'Strength Zone',
    });

    expect(payload).toMatchObject({
      grid_column: 3,
      grid_height: 4,
      grid_row: 2,
      grid_width: 5,
      image_fit: 'cover',
      image_focal_x: 0.4,
      image_focal_y: 0.6,
      image_crop_zoom: 2,
      image_url: 'https://cdn.fittrack.test/strength-front.jpg',
      image_urls: [
        'https://cdn.fittrack.test/strength-front.jpg',
        'https://cdn.fittrack.test/strength-side.jpg',
      ],
    });
  });
});
