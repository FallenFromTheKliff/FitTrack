import {
  ActivityLevel,
  FitnessGoal,
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
import { dateOnly, daysFrom } from '../time';
import {
  progressionDateAt,
  progressionMetricCount,
  progressionWeightAt,
} from '../lifecycles-profiles';
import type { DynamicSeedContext, SeedAccount } from '../types';
import { activityDateFor, memberVolumeCount } from '../volumes';

export const FOOD_ITEMS = [
  ['Breakfast', 'Garlic rice, eggs, and chicken tocino', 602, 38, 72, 18],
  ['Lunch', 'Chicken adobo bowl with vegetables', 694, 46, 78, 22],
  ['Snack', 'Banana protein smoothie', 352, 28, 42, 8],
  ['Dinner', 'Grilled tuna, rice, and ensalada', 556, 48, 55, 16],
  ['Post-workout', 'Whey isolate shake', 154, 30, 4, 2],
] as const;

export const PRODUCT_SEEDS = [
  ['whey-isolate', 'Whey Isolate 2lb', 'supplements', '1899', '1200', 36],
  ['creatine', 'Creatine Monohydrate', 'supplements', '799', '420', 48],
  ['energy-drink', 'Electrolyte Energy Drink', 'beverages', '120', '55', 96],
  ['lifting-straps', 'Lifting Straps', 'gear', '450', '180', 24],
  ['shaker-bottle', 'FitTrack Shaker Bottle', 'gear', '299', '110', 42],
  ['recovery-balm', 'Recovery Balm', 'recovery', '349', '150', 18],
  ['protein-bar', 'Protein Bar', 'snacks', '95', '42', 120],
  ['grip-gloves', 'Training Gloves', 'gear', '699', '310', 14],
] as const;

/**
 * Retail stock has no separate inventory-ledger table in the current schema.
 * Keep deterministic restocks in the audit stream so the closing quantity can
 * still be explained as opening stock + restocks - completed sale quantities.
 */
export const PRODUCT_RESTOCK_SEEDS = [
  ['whey-isolate', 28, 24],
  ['creatine', 44, 30],
  ['energy-drink', 32, 48],
  ['lifting-straps', 56, 12],
  ['shaker-bottle', 72, 18],
  ['recovery-balm', 88, 10],
  ['protein-bar', 104, 60],
  ['grip-gloves', 120, 8],
] as const;

export const EQUIPMENT_ITEMS = [
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

export function openingStockFor(
  ctx: DynamicSeedContext,
  stockQuantity: number,
) {
  return stockQuantity + 120 + Math.min(80, ctx.state.activeMemberKeys.length);
}

export function expectedOpeningStock(
  ctx: DynamicSeedContext,
  productKey: string,
) {
  const product = PRODUCT_SEEDS.find(
    (candidate) => candidate[0] === productKey,
  );
  return product ? openingStockFor(ctx, product[5]) : null;
}

export function expectedRestockQuantity(productKey: string) {
  return PRODUCT_RESTOCK_SEEDS.filter(([key]) => key === productKey).reduce(
    (total, [, , quantity]) => total + quantity,
    0,
  );
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
    const dateOfBirth = profile?.date_of_birth ?? account.dateOfBirth ?? null;
    const age = dateOfBirth
      ? ageAt(ctx.config.anchorDate, dateOfBirth)
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
      profile?.fitness_goal ?? account.fitnessGoal ?? FitnessGoal.maintenance;
    const nutritionCount = memberVolumeCount(
      ctx,
      memberKey,
      'nutrition',
      ctx.config.workoutDensity,
    );
    const metricCount = Math.max(1, progressionMetricCount(account));
    const targetRows: Array<{
      tdeeId: string;
      calculatedAt: Date;
      macroId: string;
    }> = [];
    const seedTargetIds = Array.from({ length: metricCount }, (_, index) => ({
      tdeeId:
        index === metricCount - 1
          ? seedId(`tdee:${memberKey}`)
          : seedId(`tdee:${memberKey}:history:${index}`),
      macroId:
        index === metricCount - 1
          ? seedId(`macro:${memberKey}`)
          : seedId(`macro:${memberKey}:history:${index}`),
    }));

    await ctx.prisma.tdeeProfile.updateMany({
      where: {
        id: { in: seedTargetIds.map(({ tdeeId }) => tdeeId) },
        user_id: ctx.state.userIds[memberKey],
        is_active: true,
      },
      data: { is_active: false },
    });
    await ctx.prisma.macroTarget.updateMany({
      where: {
        id: { in: seedTargetIds.map(({ macroId }) => macroId) },
        user_id: ctx.state.userIds[memberKey],
        is_active: true,
      },
      data: { is_active: false },
    });

    for (let targetIndex = 0; targetIndex < metricCount; targetIndex += 1) {
      const calculatedAt = targetDateFor(
        ctx,
        account,
        targetIndex,
        metricCount,
      );
      const historicalWeight = progressionWeightForTarget(
        account,
        targetIndex,
        metricCount,
        weightKg,
      );
      const historicalAge = dateOfBirth
        ? ageAt(calculatedAt, dateOfBirth)
        : age;
      const bmr = calculateBmr({
        age: historicalAge,
        gender,
        heightCm,
        weightKg: historicalWeight,
      });
      const tdee = bmr * activityMultiplier(activity);
      const targetCalories = goalAdjustedCalories(tdee, fitnessGoal);
      const isCurrent = targetIndex === metricCount - 1;
      const tdeeId = isCurrent
        ? seedId(`tdee:${memberKey}`)
        : seedId(`tdee:${memberKey}:history:${targetIndex}`);
      const macroId = isCurrent
        ? seedId(`macro:${memberKey}`)
        : seedId(`macro:${memberKey}:history:${targetIndex}`);
      const protein = (targetCalories * 0.33) / 4;
      const carbs = (targetCalories * 0.42) / 4;
      const fat = (targetCalories * 0.25) / 9;

      await ctx.prisma.tdeeProfile.upsert({
        where: { id: tdeeId },
        update: {
          activity_level: activity,
          age: historicalAge,
          bmr_calories: new Prisma.Decimal(bmr.toFixed(2)),
          calculated_at: calculatedAt,
          fitness_goal: fitnessGoal,
          gender,
          height_cm: new Prisma.Decimal(heightCm),
          is_active: isCurrent,
          tdee_calories: new Prisma.Decimal(tdee.toFixed(2)),
          weight_kg: new Prisma.Decimal(historicalWeight.toFixed(2)),
        },
        create: {
          id: tdeeId,
          activity_level: activity,
          age: historicalAge,
          bmr_calories: new Prisma.Decimal(bmr.toFixed(2)),
          calculated_at: calculatedAt,
          fitness_goal: fitnessGoal,
          gender,
          height_cm: new Prisma.Decimal(heightCm),
          is_active: isCurrent,
          tdee_calories: new Prisma.Decimal(tdee.toFixed(2)),
          user_id: ctx.state.userIds[memberKey],
          weight_kg: new Prisma.Decimal(historicalWeight.toFixed(2)),
        },
      });

      await ctx.prisma.macroTarget.upsert({
        where: { id: macroId },
        update: {
          carbs_g: new Prisma.Decimal(carbs.toFixed(2)),
          fat_g: new Prisma.Decimal(fat.toFixed(2)),
          is_active: isCurrent,
          protein_g: new Prisma.Decimal(protein.toFixed(2)),
          target_calories: new Prisma.Decimal(targetCalories.toFixed(2)),
          tdee_profile_id: tdeeId,
          created_at: calculatedAt,
        },
        create: {
          id: macroId,
          carbs_g: new Prisma.Decimal(carbs.toFixed(2)),
          fat_g: new Prisma.Decimal(fat.toFixed(2)),
          is_active: isCurrent,
          protein_g: new Prisma.Decimal(protein.toFixed(2)),
          target_calories: new Prisma.Decimal(targetCalories.toFixed(2)),
          tdee_profile_id: tdeeId,
          user_id: ctx.state.userIds[memberKey],
          created_at: calculatedAt,
        },
      });

      targetRows.push({
        tdeeId,
        calculatedAt,
        macroId,
      });
    }

    const currentTarget = targetRows.at(-1)!;
    ctx.state.tdeeProfileIds[memberKey] = currentTarget.tdeeId;
    ctx.state.macroTargetIds[memberKey] = currentTarget.macroId;

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
      // NutritionLog.log_date is a database date, so choose the TDEE target
      // by persisted calendar day and write the same canonical date value.
      const logDate = dateOnly(loggedAt, 0);
      const logDay = logDate.getTime();
      const quantity = logIndex % 5 === 4 ? 1 : 1.25;
      const target =
        [...targetRows]
          .reverse()
          .find(
            (candidate) =>
              dateOnly(candidate.calculatedAt, 0).getTime() <= logDay,
          ) ?? targetRows[0];
      nutritionRows.push({
        id: seedId(`nutrition-log:${memberKey}:${logIndex}`),
        calories: new Prisma.Decimal((calories * quantity).toFixed(2)),
        carbs_g: new Prisma.Decimal((carbs * quantity).toFixed(2)),
        fat_g: new Prisma.Decimal((fat * quantity).toFixed(2)),
        food_item: foodItem,
        log_date: logDate,
        macro_target_id: target?.macroId ?? null,
        meal_name: mealName,
        protein_g: new Prisma.Decimal((protein * quantity).toFixed(2)),
        quantity: new Prisma.Decimal(quantity.toFixed(2)),
        unit: quantity === 1 ? NutritionUnit.serving : NutritionUnit.cup,
        user_id: ctx.state.userIds[memberKey],
      });
    }
  }

  if (nutritionRows.length > 0) {
    const nutritionIds = nutritionRows
      .map(({ id }) => id)
      .filter((id): id is string => Boolean(id));
    await ctx.prisma.nutritionLog.deleteMany({
      where: { id: { in: nutritionIds } },
    });
    await ctx.prisma.nutritionLog.createMany({
      data: nutritionRows,
      skipDuplicates: true,
    });
  }
}

function goalAdjustedCalories(tdee: number, goal: FitnessGoal) {
  return goal === FitnessGoal.cutting
    ? tdee - 250
    : goal === FitnessGoal.bulking
      ? tdee + 250
      : tdee;
}

function targetDateFor(
  ctx: DynamicSeedContext,
  account: SeedAccount,
  index: number,
  total: number,
) {
  return (
    progressionDateAt(ctx.config, account, index, total, 8) ??
    daysFrom(ctx.config.anchorDate, -8, 8)
  );
}

function progressionWeightForTarget(
  account: SeedAccount,
  index: number,
  total: number,
  fallbackWeight: number,
) {
  return account.physicalBaseline
    ? progressionWeightAt(account.physicalBaseline, account, index, total)
    : fallbackWeight;
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
          openingStockFor(ctx, stockQuantity) + expectedRestockQuantity(key) <=
          (index % 3 === 0 ? 20 : 10)
            ? daysFrom(ctx.config.anchorDate, -1, 8)
            : null,
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
          openingStockFor(ctx, stockQuantity) + expectedRestockQuantity(key) <=
          (index % 3 === 0 ? 20 : 10)
            ? daysFrom(ctx.config.anchorDate, -1, 8)
            : null,
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
  for (const [index, item] of EQUIPMENT_ITEMS.entries()) {
    const [key, , , quantityTotal, quantityCurrent] = item;
    const writeOff = {
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
    await ctx.prisma.equipmentWriteOff.upsert({
      where: { id: writeOff.id },
      update: writeOff,
      create: writeOff,
    });
  }

  const restockAudits = PRODUCT_RESTOCK_SEEDS.map(
    ([key, dayOffset, quantity], index) => {
      const opening = expectedOpeningStock(ctx, key) ?? 0;
      const priorRestocks = PRODUCT_RESTOCK_SEEDS.slice(0, index)
        .filter(([candidate]) => candidate === key)
        .reduce((total, [, , amount]) => total + amount, 0);
      const before = opening + priorRestocks;
      const after = before + quantity;
      return {
        id: seedId(`audit:product-restock:${key}:${index}`),
        action: 'PRODUCT_RESTOCKED',
        after: {
          source: 'dynamic-seed',
          quantity_added: quantity,
          stock_quantity: after,
        },
        before: { source: 'dynamic-seed', stock_quantity: before },
        created_at: daysFrom(ctx.config.anchorDate, -dayOffset, 14),
        entity: 'RetailProduct',
        entity_id: seedId(`retail-product:${key}`),
        ip_address: '127.0.0.30',
        user_id: ctx.state.userIds[staffKeys[index % staffKeys.length]],
      };
    },
  );
  for (const audit of restockAudits) {
    await ctx.prisma.auditLog.upsert({
      where: { id: audit.id },
      update: audit,
      create: audit,
    });
  }
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
  const seedSaleIds = new Set<string>();
  customerKeys.forEach((memberKey) => {
    const saleCount = memberVolumeCount(ctx, memberKey, 'sales');
    for (let saleIndex = 0; saleIndex < saleCount; saleIndex += 1) {
      seedSaleIds.add(seedId(`sale:${memberKey}:${saleIndex}`));
    }
  });
  const [completedSaleRows, existingSaleItems] = await Promise.all([
    ctx.prisma.saleTransaction.findMany({
      where: { status: SaleStatus.completed },
      select: { id: true },
    }),
    ctx.prisma.saleTransactionItem.findMany({
      select: { product_id: true, quantity: true, transaction_id: true },
    }),
  ]);
  const existingCompletedSaleIds = new Set(
    completedSaleRows.map(({ id }) => id).filter((id) => !seedSaleIds.has(id)),
  );
  const additiveSoldByProduct = new Map<string, number>();
  for (const item of existingSaleItems) {
    if (!existingCompletedSaleIds.has(item.transaction_id)) continue;
    additiveSoldByProduct.set(
      item.product_id,
      (additiveSoldByProduct.get(item.product_id) ?? 0) + item.quantity,
    );
  }
  const remainingStock = new Map(
    PRODUCT_SEEDS.map(([key, , , , , stockQuantity]) => [
      key,
      Math.max(
        0,
        openingStockFor(ctx, stockQuantity) +
          expectedRestockQuantity(key) -
          (additiveSoldByProduct.get(seedId(`retail-product:${key}`)) ?? 0),
      ),
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
        const productKey =
          productKeys[(rowIndex + itemIndex) % productKeys.length];
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
          rowIndex % 4 === 0
            ? SalePaymentMethod.paymongo
            : SalePaymentMethod.cash,
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
        idempotency_key: seedExternalId(
          `payment:product:${memberKey}:${saleIndex}`,
        ),
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
    const productIndex = PRODUCT_SEEDS.findIndex(
      (product) => product[0] === productKey,
    );
    const reorderThreshold =
      productIndex >= 0 && productIndex % 3 === 0 ? 20 : 10;
    await ctx.prisma.retailProduct.update({
      where: { id: ctx.state.productIds[productKey] },
      data: {
        last_low_stock_alert_at:
          stockQuantity <= reorderThreshold
            ? daysFrom(ctx.config.anchorDate, -1, 8)
            : null,
        stock_quantity: stockQuantity,
      },
    });
  }

  for (const row of saleRows) {
    await ctx.prisma.saleTransaction.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
  for (const row of itemRows) {
    await ctx.prisma.saleTransactionItem.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
  for (const row of paymentRows) {
    await ctx.prisma.payment.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

export async function seedBodyNutrition(ctx: DynamicSeedContext) {
  await seedNutrition(ctx);

  ctx.notableIds.demoPremiumMacroTargetId = seedId('macro:member-premium');

  return {
    counts: {
      nutritionMembers: [
        ...ctx.state.activeMemberKeys,
        ...ctx.state.historicalMemberKeys,
      ].length,
    },
  };
}

export async function seedNutritionInventory(ctx: DynamicSeedContext) {
  await seedBodyNutrition(ctx);
  await seedInventory(ctx);
  await seedSales(ctx);

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
