import {
  ActivityLevel,
  Gender,
  NutritionUnit,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  Prisma,
  SalePaymentMethod,
  SaleSource,
  SaleStatus,
} from '@prisma/client';
import { seedExternalId, seedId } from '../ids';
import { daysFrom } from '../time';
import type { DynamicSeedContext } from '../types';
import { activityDateFor, memberVolumeCount } from '../volumes';

const FOOD_ITEMS = [
  ['Breakfast', 'Garlic rice, eggs, and chicken tocino', 620, 38, 72, 18],
  ['Lunch', 'Chicken adobo bowl with vegetables', 710, 46, 78, 22],
  ['Snack', 'Banana protein smoothie', 360, 28, 42, 8],
  ['Dinner', 'Grilled tuna, rice, and ensalada', 590, 48, 55, 16],
  ['Post-workout', 'Whey isolate shake', 160, 30, 4, 2],
] as const;

const PRODUCT_SEEDS = [
  ['whey-isolate', 'Whey Isolate 2lb', 'supplements', '1899', '1200', 36],
  ['creatine', 'Creatine Monohydrate', 'supplements', '799', '420', 48],
  ['energy-drink', 'Electrolyte Energy Drink', 'beverages', '120', '55', 96],
  ['lifting-straps', 'Lifting Straps', 'gear', '450', '180', 24],
  ['shaker-bottle', 'FitTrack Shaker Bottle', 'gear', '299', '110', 42],
  ['recovery-balm', 'Recovery Balm', 'recovery', '349', '150', 18],
  ['protein-bar', 'Protein Bar', 'snacks', '95', '42', 120],
  ['grip-gloves', 'Training Gloves', 'gear', '699', '310', 14],
] as const;

const EQUIPMENT_ITEMS = [
  [
    'yoga-mats',
    'Yoga Mats',
    'Studio mats for mobility and cooldown classes',
    35,
    32,
    'mats',
  ],
  [
    'jump-ropes',
    'Jump Ropes',
    'Conditioning ropes for warmups',
    24,
    21,
    'ropes',
  ],
  [
    'resistance-bands',
    'Resistance Bands',
    'Assorted resistance bands',
    60,
    54,
    'bands',
  ],
  [
    'foam-rollers',
    'Foam Rollers',
    'Recovery rollers for mobility area',
    20,
    18,
    'rollers',
  ],
  [
    'boxing-gloves',
    'Boxing Gloves',
    'Shared gloves for boxing ring users',
    18,
    15,
    'pairs',
  ],
] as const;

function calculateBmr(args: {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
}) {
  const base = 10 * args.weightKg + 6.25 * args.heightCm - 5 * args.age;
  return args.gender === Gender.female ? base - 161 : base + 5;
}

function activityMultiplier(activity: ActivityLevel) {
  switch (activity) {
    case ActivityLevel.sedentary:
      return 1.2;
    case ActivityLevel.light:
      return 1.375;
    case ActivityLevel.moderate:
      return 1.55;
    case ActivityLevel.very_active:
      return 1.725;
    case ActivityLevel.active:
    default:
      return 1.65;
  }
}

function ageAt(anchor: Date, dateOfBirth: Date) {
  let age = anchor.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayNotReached =
    anchor.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (anchor.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      anchor.getUTCDate() < dateOfBirth.getUTCDate());
  if (birthdayNotReached) {
    age -= 1;
  }
  return Math.max(13, age);
}

export function openingStockFor(ctx: DynamicSeedContext, stockQuantity: number) {
  return stockQuantity + 120 + Math.min(80, ctx.state.activeMemberKeys.length);
}

export function expectedOpeningStock(
  ctx: DynamicSeedContext,
  productKey: string,
) {
  const product = PRODUCT_SEEDS.find((candidate) => candidate[0] === productKey);
  return product ? openingStockFor(ctx, product[5]) : null;
}

async function seedNutrition(ctx: DynamicSeedContext) {
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const nutritionRows: Prisma.NutritionLogCreateManyInput[] = [];

  for (const [index, memberKey] of memberKeys.entries()) {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === memberKey,
    );
    if (!account) {
      continue;
    }

    const profile = await ctx.prisma.userProfile.findUnique({
      where: { user_id: ctx.state.userIds[memberKey] },
      select: {
        activity_level: true,
        date_of_birth: true,
        fitness_goal: true,
        gender: true,
        height_cm: true,
        weight_kg: true,
      },
    });
    const age = profile?.date_of_birth
      ? ageAt(ctx.config.anchorDate, profile.date_of_birth)
      : 21 + (index % 24);
    const gender =
      profile?.gender ??
      account.gender ??
      (index % 2 === 0 ? Gender.female : Gender.male);
    const weightKg = Number(
      profile?.weight_kg ?? account.weightKg ?? 57 + (index % 26),
    );
    const heightCm = Number(
      profile?.height_cm ?? account.heightCm ?? 156 + (index % 28),
    );
    const activity =
      profile?.activity_level ?? account.activityLevel ?? ActivityLevel.active;
    const fitnessGoal =
      profile?.fitness_goal ?? account.fitnessGoal ?? 'maintenance';
    const bmr = calculateBmr({ age, gender, heightCm, weightKg });
    const tdee = bmr * activityMultiplier(activity);
    const targetCalories =
      fitnessGoal === 'cutting'
        ? tdee - 250
        : fitnessGoal === 'bulking'
          ? tdee + 250
          : tdee;
    const tdeeId = seedId(`tdee:${memberKey}`);
    const macroId = seedId(`macro:${memberKey}`);

    ctx.state.tdeeProfileIds[memberKey] = tdeeId;
    ctx.state.macroTargetIds[memberKey] = macroId;

    await ctx.prisma.tdeeProfile.upsert({
      where: { id: tdeeId },
      update: {
        activity_level: activity,
        age,
        bmr_calories: new Prisma.Decimal(bmr.toFixed(2)),
        calculated_at: daysFrom(ctx.config.anchorDate, -8 + (index % 4), 8),
        fitness_goal: fitnessGoal,
        gender,
        height_cm: new Prisma.Decimal(heightCm),
        is_active: true,
        tdee_calories: new Prisma.Decimal(tdee.toFixed(2)),
        weight_kg: new Prisma.Decimal(weightKg),
      },
      create: {
        id: tdeeId,
        activity_level: activity,
        age,
        bmr_calories: new Prisma.Decimal(bmr.toFixed(2)),
        calculated_at: daysFrom(ctx.config.anchorDate, -8 + (index % 4), 8),
        fitness_goal: fitnessGoal,
        gender,
        height_cm: new Prisma.Decimal(heightCm),
        is_active: true,
        tdee_calories: new Prisma.Decimal(tdee.toFixed(2)),
        user_id: ctx.state.userIds[memberKey],
        weight_kg: new Prisma.Decimal(weightKg),
      },
    });

    await ctx.prisma.macroTarget.upsert({
      where: { id: macroId },
      update: {
        carbs_g: new Prisma.Decimal(((targetCalories * 0.42) / 4).toFixed(2)),
        fat_g: new Prisma.Decimal(((targetCalories * 0.25) / 9).toFixed(2)),
        is_active: true,
        protein_g: new Prisma.Decimal((weightKg * 1.8).toFixed(2)),
        target_calories: new Prisma.Decimal(targetCalories.toFixed(2)),
        tdee_profile_id: tdeeId,
      },
      create: {
        id: macroId,
        carbs_g: new Prisma.Decimal(((targetCalories * 0.42) / 4).toFixed(2)),
        fat_g: new Prisma.Decimal(((targetCalories * 0.25) / 9).toFixed(2)),
        is_active: true,
        protein_g: new Prisma.Decimal((weightKg * 1.8).toFixed(2)),
        target_calories: new Prisma.Decimal(targetCalories.toFixed(2)),
        tdee_profile_id: tdeeId,
        user_id: ctx.state.userIds[memberKey],
      },
    });

    const nutritionCount = memberVolumeCount(
      ctx,
      memberKey,
      'nutrition',
      ctx.config.workoutDensity,
    );
    for (let logIndex = 0; logIndex < nutritionCount; logIndex += 1) {
      const food = FOOD_ITEMS[logIndex % FOOD_ITEMS.length];
      const [mealName, foodItem, calories, protein, carbs, fat] = food;
      const loggedAt = activityDateFor(
        ctx,
        memberKey,
        logIndex,
        nutritionCount,
        7 + (logIndex % 12),
      );
      if (!loggedAt) {
        continue;
      }
      nutritionRows.push({
        id: seedId(`nutrition-log:${memberKey}:${logIndex}`),
        calories: new Prisma.Decimal(calories + ((index + logIndex) % 40)),
        carbs_g: new Prisma.Decimal(carbs),
        fat_g: new Prisma.Decimal(fat),
        food_item: foodItem,
        log_date: loggedAt,
        macro_target_id: macroId,
        meal_name: mealName,
        protein_g: new Prisma.Decimal(protein),
        quantity: new Prisma.Decimal(logIndex % 5 === 4 ? '1' : '1.25'),
        unit: logIndex % 5 === 4 ? NutritionUnit.serving : NutritionUnit.cup,
        user_id: ctx.state.userIds[memberKey],
      });
    }
  }

  await ctx.prisma.nutritionLog.createMany({
    data: nutritionRows,
    skipDuplicates: true,
  });
}

async function seedInventory(ctx: DynamicSeedContext) {
  for (const [index, product] of PRODUCT_SEEDS.entries()) {
    const [key, name, category, price, cost, stockQuantity] = product;
    const productId = seedId(`retail-product:${key}`);
    ctx.state.productIds[key] = productId;
    await ctx.prisma.retailProduct.upsert({
      where: { id: productId },
      update: {
        category,
        cost: new Prisma.Decimal(cost),
        description: `${category} item for inventory, search, low-stock, and sales review.`,
        image_url: null,
        is_active: true,
        last_low_stock_alert_at:
          stockQuantity <= 18 ? daysFrom(ctx.config.anchorDate, -1, 8) : null,
        name,
        price: new Prisma.Decimal(price),
        reorder_threshold: index % 3 === 0 ? 20 : 10,
        stock_quantity: openingStockFor(ctx, stockQuantity),
      },
      create: {
        id: productId,
        category,
        cost: new Prisma.Decimal(cost),
        description: `${category} item for inventory, search, low-stock, and sales review.`,
        image_url: null,
        is_active: true,
        last_low_stock_alert_at:
          stockQuantity <= 18 ? daysFrom(ctx.config.anchorDate, -1, 8) : null,
        name,
        price: new Prisma.Decimal(price),
        reorder_threshold: index % 3 === 0 ? 20 : 10,
        stock_quantity: openingStockFor(ctx, stockQuantity),
      },
    });
  }

  for (const item of EQUIPMENT_ITEMS) {
    const [key, name, description, quantityTotal, quantityCurrent, unit] = item;
    await ctx.prisma.gymEquipmentItem.upsert({
      where: { id: seedId(`equipment-item:${key}`) },
      update: {
        description,
        image_url: null,
        is_active: true,
        name,
        quantity_current: quantityCurrent,
        quantity_total: quantityTotal,
        unit,
      },
      create: {
        id: seedId(`equipment-item:${key}`),
        description,
        image_url: null,
        is_active: true,
        name,
        quantity_current: quantityCurrent,
        quantity_total: quantityTotal,
        unit,
      },
    });
  }

  const staffKeys = ctx.state.staffKeys;
  await ctx.prisma.equipmentWriteOff.createMany({
    data: EQUIPMENT_ITEMS.slice(0, 4).map((item, index) => {
      const [key, , , quantityTotal, quantityCurrent] = item;
      return {
        id: seedId(`equipment-write-off:${key}`),
        created_at: daysFrom(ctx.config.anchorDate, -9 + index, 16),
        equipment_id: seedId(`equipment-item:${key}`),
        performed_by: ctx.state.userIds[staffKeys[index % staffKeys.length]],
        quantity_before: quantityTotal,
        quantity_lost: quantityTotal - quantityCurrent,
        quantity_set_to: quantityCurrent,
        reason:
          index % 2 === 0
            ? 'Worn-out shared equipment write-off.'
            : 'Damaged item found during closing inventory.',
      };
    }),
    skipDuplicates: true,
  });
}

async function seedSales(ctx: DynamicSeedContext) {
  const staffKeys = ctx.state.staffKeys;
  const customerKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const productKeys = PRODUCT_SEEDS.map((product) => product[0]);
  const saleRows: Prisma.SaleTransactionCreateManyInput[] = [];
  const itemRows: Prisma.SaleTransactionItemCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const remainingStock = new Map(
    PRODUCT_SEEDS.map(([key, , , , , stockQuantity]) => [
      key,
      openingStockFor(ctx, stockQuantity),
    ]),
  );

  customerKeys.forEach((memberKey, index) => {
    const saleCount = memberVolumeCount(ctx, memberKey, 'sales');
    for (let saleIndex = 0; saleIndex < saleCount; saleIndex += 1) {
    const rowIndex = index + saleIndex;
    const saleId = seedId(`sale:${memberKey}:${saleIndex}`);
    const paymentId = seedId(`payment:product:${memberKey}:${saleIndex}`);
    const itemCount = 1 + (rowIndex % 3);
    let total = new Prisma.Decimal(0);
    const createdAt = activityDateFor(
      ctx,
      memberKey,
      saleIndex,
      saleCount,
      10 + (rowIndex % 9),
    );
    if (!createdAt) {
      continue;
    }
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const productKey = productKeys[(rowIndex + itemIndex) % productKeys.length];
      const product = PRODUCT_SEEDS.find(
        (candidate) => candidate[0] === productKey,
      )!;
      const unitPrice = new Prisma.Decimal(product[3]);
      const available = remainingStock.get(productKey) ?? 0;
      const quantity = Math.min(1 + ((rowIndex + itemIndex) % 3), available);
      if (quantity <= 0) {
        continue;
      }
      const subtotal = unitPrice.mul(quantity);
      total = total.plus(subtotal);
      remainingStock.set(productKey, available - quantity);

      itemRows.push({
        id: seedId(`sale-item:${memberKey}:${saleIndex}:${itemIndex}`),
        created_at: createdAt,
        product_id: ctx.state.productIds[productKey],
        quantity,
        subtotal,
        transaction_id: saleId,
        unit_price: unitPrice,
      });
    }

    if (total.lessThanOrEqualTo(0)) {
      continue;
    }

    saleRows.push({
      id: saleId,
      created_at: createdAt,
      customer_name: null,
      customer_user_id: ctx.state.userIds[memberKey],
      notes:
        rowIndex % 5 === 0
          ? 'Premium member supplement bundle.'
          : 'Retail sale for revenue analytics.',
      payment_id: paymentId,
      payment_method:
        rowIndex % 4 === 0 ? SalePaymentMethod.paymongo : SalePaymentMethod.cash,
      processed_by: ctx.state.userIds[staffKeys[rowIndex % staffKeys.length]],
      source: rowIndex % 3 === 0 ? SaleSource.mobile : SaleSource.manual,
      status: SaleStatus.completed,
      total_amount: total,
    });

    paymentRows.push({
      id: paymentId,
      amount: total,
      created_at: createdAt,
      gateway_event_id: null,
      gateway_metadata: { memberKey, saleId, source: 'product-sale' },
      idempotency_key: seedExternalId(`payment:product:${memberKey}:${saleIndex}`),
      payable_id: saleId,
      payable_type: PayableType.product,
      payment_stage: PaymentStage.full,
      provider:
        rowIndex % 4 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      provider_ref:
        rowIndex % 4 === 0
          ? seedExternalId(`paymongo:product:${memberKey}:${saleIndex}`)
          : null,
      rejection_reason: null,
      status: PaymentStatus.completed,
      user_id: ctx.state.userIds[memberKey],
      verified_at: daysFrom(createdAt, 0, createdAt.getUTCHours() + 1),
      verified_by: ctx.state.userIds[staffKeys[rowIndex % staffKeys.length]],
    });
    }
  });

  for (const [productKey, stockQuantity] of remainingStock.entries()) {
    await ctx.prisma.retailProduct.update({
      where: { id: ctx.state.productIds[productKey] },
      data: { stock_quantity: stockQuantity },
    });
  }

  await ctx.prisma.saleTransaction.createMany({
    data: saleRows,
    skipDuplicates: true,
  });
  await ctx.prisma.saleTransactionItem.createMany({
    data: itemRows,
    skipDuplicates: true,
  });
  await ctx.prisma.payment.createMany({
    data: paymentRows,
    skipDuplicates: true,
  });
}

export async function seedNutritionInventory(ctx: DynamicSeedContext) {
  await seedNutrition(ctx);
  await seedInventory(ctx);
  await seedSales(ctx);

  ctx.notableIds.demoPremiumMacroTargetId = seedId('macro:member-premium');
  ctx.notableIds.wheyProductId = seedId('retail-product:whey-isolate');

  return {
    counts: {
      products: PRODUCT_SEEDS.length,
      nutritionMembers: [
        ...ctx.state.activeMemberKeys,
        ...ctx.state.historicalMemberKeys,
      ].length,
    },
  };
}
