import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExerciseCategory } from '@prisma/client';

import {
  AiPythonClientService,
  type BusinessAnalyticsInsightRequest,
  type BusinessInsightOutcomeEvaluationRequest,
} from './ai-python-client.service';

const createBusinessInsightInput = (
  analysis?: BusinessAnalyticsInsightRequest['analysis'],
): BusinessAnalyticsInsightRequest =>
  ({
    grounding: {
      window: {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        period: 'monthly',
        focus: 'overview',
      },
      overview: {
        total_revenue: '8849.00',
        total_check_ins: 342,
        new_members: 18,
        completed_coaching_sessions: 24,
      },
      revenue: {
        totals: {
          membership_revenue: '4999.00',
          booking_revenue: '1200.00',
          product_revenue: '850.00',
          coaching_payments_collected: '3000.00',
          coaching_gym_revenue: '1800.00',
          total_revenue: '8849.00',
        },
        series: [],
      },
      attendance: {
        series: [],
        peak_hours: [],
      },
      membership: {
        new_members: 18,
        active_members: 124,
        top_plans: [],
      },
      coaching: {
        coaches: [],
      },
    },
    ...(analysis ? { analysis } : {}),
  }) as unknown as BusinessAnalyticsInsightRequest;

describe('AiPythonClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when required AI config is missing', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue(''),
    };
    const service = new AiPythonClientService(config as ConfigService);

    await expect(service.assertHealthy()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('posts generation requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          weeks: [
            {
              week_number: 1,
              days: [
                {
                  day_of_week: 1,
                  exercises: [{ name: 'Barbell Back Squat', sets: 4 }],
                },
              ],
            },
          ],
          token_count: 321,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.generatePlan({
      userContext: {
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'bulking',
      },
      planInput: {
        duration_weeks: 8,
        days_per_week: 4,
        preferences: 'Prefer barbells',
      },
      allowedExercises: [
        {
          name: 'Barbell Back Squat',
          muscle_group: 'legs',
          category: ExerciseCategory.strength,
        },
      ],
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      user_context: { gender: string };
      allowed_exercises: Array<{ name: string }>;
    };

    expect(url).toBe('https://ai.fittrack.test/generate-plan');
    expect(init?.method).toBe('POST');
    expect(body.user_context.gender).toBe('male');
    expect(body.allowed_exercises[0]?.name).toBe('Barbell Back Squat');
    expect(result).toEqual({
      weeks: [
        {
          week_number: 1,
          days: [
            {
              day_of_week: 1,
              exercises: [{ name: 'Barbell Back Squat', sets: 4 }],
            },
          ],
        },
      ],
      token_count: 321,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects invalid upstream generation payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.generatePlan({
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'bulking',
        },
        planInput: {
          duration_weeks: 8,
          days_per_week: 4,
        },
        allowedExercises: [],
      }),
    ).rejects.toMatchObject({
      response: {
        status: 502,
        detail: 'The AI plan service returned an invalid payload.',
      },
    });
  });

  it('posts chat requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'Let us work through your nutrition goals.',
          action: 'NONE',
          params: null,
          token_count: 77,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.chat({
      messages: [{ role: 'user', content: 'Help me with nutrition.' }],
      userContext: {
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'cutting',
      },
      sessionContext: {
        session_id: 'session-1',
        context_type: 'nutrition',
        assistant_scope: 'member_fitness',
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      messages: Array<{ role: string; content: string }>;
      session_context: { context_type: string; assistant_scope: string };
    };

    expect(url).toBe('https://ai.fittrack.test/chat');
    expect(init?.method).toBe('POST');
    expect(body.messages[0]).toEqual({
      role: 'user',
      content: 'Help me with nutrition.',
    });
    expect(body.session_context.context_type).toBe('nutrition');
    expect(body.session_context.assistant_scope).toBe('member_fitness');
    expect(result).toEqual({
      content: 'Let us work through your nutrition goals.',
      action: 'NONE',
      params: null,
      token_count: 77,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects malformed upstream chat payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: '', action: 'NONE' }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'Help me with nutrition.' }],
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'cutting',
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'nutrition',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 502,
        detail: 'The AI chat service returned an invalid payload.',
      },
    });
  });

  it('turns a non-JSON 200 chat body into a controlled 502', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not-json', { status: 200 }));
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'hello' }],
        userContext: {
          age: null,
          gender: null,
          weight_kg: null,
          height_cm: null,
          activity_level: null,
          fitness_goal: null,
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'general',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 502,
        title: 'Invalid AI Chat Response',
        detail: 'The AI chat service returned a non-JSON payload.',
      },
    });
  });

  it('surfaces upstream plan-generation failures instead of falling back locally', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response('{"detail":"Not Found"}', { status: 404 }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.generatePlan({
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'cutting',
        },
        planInput: {
          duration_weeks: 2,
          days_per_week: 3,
          preferences: 'Prefer dumbbells',
        },
        allowedExercises: [
          {
            name: 'Barbell Back Squat',
            muscle_group: 'legs',
            category: ExerciseCategory.strength,
          },
          {
            name: 'Lat Pulldown',
            muscle_group: 'back',
            category: ExerciseCategory.strength,
          },
        ],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('surfaces upstream chat failures instead of falling back locally', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response('{"detail":"Not Found"}', { status: 404 }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'Help me with nutrition.' }],
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'cutting',
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'nutrition',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('maps Brodigy chat timeouts to a redacted 503 response', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const timeoutError = Object.assign(new Error('provider timeout'), {
      name: 'TimeoutError',
    });
    const fetchMock = jest.fn<typeof fetch>().mockRejectedValue(timeoutError);
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'Are you open today?' }],
        userContext: {
          age: null,
          gender: null,
          weight_kg: null,
          height_cm: null,
          activity_level: null,
          fitness_goal: null,
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'general',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toMatchObject({
      response: {
        type: 'SERVICE_UNAVAILABLE',
        status: 503,
        detail:
          'BrodigyAI timed out while waiting for the AI service. Please try again.',
      },
    });
  });

  it('rejects malformed upstream chat payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: '', action: 'NONE' }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'Help me with nutrition.' }],
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'cutting',
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'nutrition',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts grounded gym-chat requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
          out_of_scope: false,
          sources: ['membership_plans'],
          follow_up_suggestions: [
            'Ask which membership plan fits your visit frequency.',
          ],
          token_count: 21,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.chatGym({
      sessionId: 'session-1',
      message: 'What membership plans do you offer?',
      grounding: {
        operating_hours: [],
        special_schedules: [],
        faqs: [],
        membership_plans: [],
        session_history: [],
        user_context: {
          first_name: 'Alex',
          role: 'member',
          active_membership: true,
        },
      },
      policy: {
        gymOnly: true,
        refuseOutOfScope: true,
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      session_id: string;
      message: string;
      policy: {
        gym_only: boolean;
        refuse_out_of_scope: boolean;
      };
    };

    expect(url).toBe('https://ai.fittrack.test/chat/gym');
    expect(init?.method).toBe('POST');
    expect(body).toMatchObject({
      session_id: 'session-1',
      message: 'What membership plans do you offer?',
      policy: {
        gym_only: true,
        refuse_out_of_scope: true,
      },
    });
    expect(result).toEqual({
      reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
      out_of_scope: false,
      sources: ['membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      token_count: 21,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects malformed upstream gym-chat payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: '',
          out_of_scope: false,
          sources: ['membership_plans'],
          follow_up_suggestions: [],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chatGym({
        sessionId: 'session-1',
        message: 'What membership plans do you offer?',
        grounding: {
          operating_hours: [],
          special_schedules: [],
          faqs: [],
          membership_plans: [],
          session_history: [],
        },
        policy: {
          gymOnly: true,
          refuseOutOfScope: true,
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('turns a non-JSON 200 gym-chat body into a controlled 502', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not-json', { status: 200 }));
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chatGym({
        sessionId: 'session-1',
        message: 'hello',
        grounding: {
          operating_hours: [],
          special_schedules: [],
          faqs: [],
          membership_plans: [],
          session_history: [],
        },
        policy: {
          gymOnly: true,
          refuseOutOfScope: true,
        },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 502,
        title: 'Invalid Gym Chat Response',
        detail: 'The AI gym-chat service returned a non-JSON payload.',
      },
    });
  });

  it('hides raw upstream diagnostics for chat failures', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) =>
        key === 'ai.apiBaseUrl' ? 'https://ai.fittrack.test' : fallback,
      ),
    };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'User Safety: safe; internal provider diagnostic' },
        }),
        { status: 400 },
      ),
    );

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'hello' }],
        userContext: {
          age: null,
          gender: null,
          weight_kg: null,
          height_cm: null,
          activity_level: null,
          fitness_goal: null,
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'general',
          assistant_scope: 'member_fitness',
        },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 400,
        title: 'AI Chat Failed',
        type: 'BAD_GATEWAY',
        detail: 'The AI chat service rejected the chat request.',
      },
    });
  });

  it('hides raw upstream diagnostics for gym-chat failures', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) =>
        key === 'ai.apiBaseUrl' ? 'https://ai.fittrack.test' : fallback,
      ),
    };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      new Response('User Safety: safe; internal provider diagnostic', {
        status: 400,
      }),
    );

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chatGym({
        sessionId: 'session-1',
        message: 'hello',
        grounding: {
          operating_hours: [],
          special_schedules: [],
          faqs: [],
          membership_plans: [],
          session_history: [],
        },
        policy: {
          gymOnly: true,
          refuseOutOfScope: true,
        },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 400,
        title: 'Gym Chat Failed',
        type: 'BAD_GATEWAY',
        detail: 'The AI gym-chat service rejected the grounded chat request.',
      },
    });
  });

  it('posts tdee recalculation requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          bmr: 1700.25,
          tdee: 2450.5,
          target_calories: 2200,
          protein_g: 180,
          carbs_g: 210,
          fat_g: 65,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.calculateTdee({
      age: 28,
      gender: 'male',
      weight_kg: 78,
      height_cm: 175,
      activity_level: 'moderate',
      fitness_goal: 'cutting',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      age: number;
      gender: string;
      fitness_goal: string;
    };

    expect(url).toBe('https://ai.fittrack.test/calculate-tdee');
    expect(init?.method).toBe('POST');
    expect(body).toMatchObject({
      age: 28,
      gender: 'male',
      fitness_goal: 'cutting',
    });
    expect(result).toEqual({
      bmr: 1700.25,
      tdee: 2450.5,
      target_calories: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 65,
    });
  });

  it('rejects invalid upstream tdee payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          bmr: '1700.25',
          tdee: 2450.5,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.calculateTdee({
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'cutting',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('falls back to a local tdee calculation when the upstream route is missing', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response('{"detail":"Not Found"}', { status: 404 }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.calculateTdee({
      age: 28,
      gender: 'male',
      weight_kg: 78,
      height_cm: 175,
      activity_level: 'moderate',
      fitness_goal: 'cutting',
    });

    expect(result).toEqual({
      bmr: 1738.75,
      tdee: 2695.06,
      target_calories: 2195,
      protein_g: 172,
      carbs_g: 240,
      fat_g: 61,
    });
  });

  it('posts pose-analysis requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          rep_event: true,
          rep_count_delta: 1,
          confidence: 0.94,
          exercise_class: 'squat',
          processing_mode: 'legacy_frame',
          phase: 'rising',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.analyzePoseFrame({
      poseSessionId: 'pose-1',
      frameBase64: 'frame-data',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      pose_session_id: string;
      frame_b64: string;
    };

    expect(url).toBe('https://ai.fittrack.test/pose/analyze');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(body.frame_b64).toBe('frame-data');
    expect(result).toEqual({
      rep_event: true,
      rep_count_delta: 1,
      confidence: 0.94,
      exercise_class: 'squat',
      processing_mode: 'legacy_frame',
      phase: 'rising',
    });
  });

  it('rejects invalid pose-sequence analysis payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          confidence: 0.94,
          exercise_class: 'squat',
          movement_contract: {
            exercise: 'squat',
            dominant_joint: 'ankle',
            rep_thresholds: {
              down: { angle: 88, tolerance: 12 },
              up: { angle: 166, tolerance: 10 },
            },
            secondary_check: 'hip_depth',
            oscillating_joints: ['hip', 'knee'],
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.analyzePoseSequence({
        poseSessionId: 'pose-1',
        landmarkSchema: 'mediapipe_pose_v1',
        exerciseHint: 'Barbell Back Squat',
        cameraFacingMode: 'user',
        frames: [
          {
            captured_at_ms: 1712844369000,
            keypoints: Array.from({ length: 33 }, () => ({
              x: 0.1,
              y: 0.2,
              z: 0,
              visibility: 0.95,
            })),
          },
        ],
        signals: {
          angles: [
            {
              captured_at_ms: 1712844369000,
              elbow: 150,
              shoulder: 90,
              hip: 120,
              knee: 95,
            },
          ],
          orientation: {
            body_orientation: 'upright',
            torso_slope_deg: 72,
            vector: { x: 0.01, y: 0.18 },
          },
          visibility: {
            average_visibility: 0.95,
            feet_visibility: 0.92,
            low_confidence_landmarks: [],
            reliable_frame_count: 1,
            wrist_visibility: 0.93,
          },
          hip: {
            average_y: 0.52,
            range_y: 0.01,
            stable: true,
          },
          temporal: {
            amplitudes: { hip: 4, knee: 15 },
            oscillating_joints: ['knee'],
          },
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('retries pose-sequence analysis without signals for legacy AI runtimes', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'INVALID_REQUEST',
            title: 'Invalid Request',
            status: 422,
            detail: 'body.signals: Extra inputs are not permitted',
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            confidence: 0.93,
            exercise_class: 'squat',
            matched_profile_id: 'profile-1',
            subject_locked: true,
            subject_lock_confidence: 0.98,
            classification_source: 'preset',
            needs_confirmation: false,
            candidate_exercises: ['squat'],
            form_feedback: ['Keep your chest up.'],
          }),
          { status: 200 },
        ),
      );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.analyzePoseSequence({
      poseSessionId: 'pose-1',
      landmarkSchema: 'mediapipe_pose_v1',
      exerciseHint: 'Barbell Back Squat',
      cameraFacingMode: 'user',
      frames: [
        {
          captured_at_ms: 1712844369000,
          keypoints: Array.from({ length: 33 }, () => ({
            x: 0.1,
            y: 0.2,
            z: 0,
            visibility: 0.95,
          })),
        },
      ],
      signals: {
        angles: [
          {
            captured_at_ms: 1712844369000,
            elbow: 150,
            shoulder: 90,
            hip: 120,
            knee: 95,
          },
        ],
        orientation: {
          body_orientation: 'upright',
          torso_slope_deg: 72,
          vector: { x: 0.01, y: 0.18 },
        },
        visibility: {
          average_visibility: 0.95,
          feet_visibility: 0.92,
          low_confidence_landmarks: [],
          reliable_frame_count: 1,
          wrist_visibility: 0.93,
        },
        hip: {
          average_y: 0.52,
          range_y: 0.01,
          stable: true,
        },
        temporal: {
          amplitudes: { hip: 4, knee: 15 },
          oscillating_joints: ['knee'],
        },
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const firstRequestBody = calls[0]?.[1]?.body;
    const secondRequestBody = calls[1]?.[1]?.body;
    const firstBody = JSON.parse(
      typeof firstRequestBody === 'string' ? firstRequestBody : '{}',
    ) as Record<string, unknown>;
    const secondBody = JSON.parse(
      typeof secondRequestBody === 'string' ? secondRequestBody : '{}',
    ) as Record<string, unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.signals).toBeDefined();
    expect(secondBody.signals).toBeUndefined();
    expect(result).toEqual({
      confidence: 0.93,
      exercise_class: 'squat',
      matched_profile_id: 'profile-1',
      subject_locked: true,
      subject_lock_confidence: 0.98,
      classification_source: 'preset',
      needs_confirmation: false,
      candidate_exercises: ['squat'],
      form_feedback: ['Keep your chest up.'],
    });
  });

  it('posts pose-session bootstrap requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          accepted_fps: 15,
          subject_lock_mode: 'single_subject',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.bootstrapPoseSession({
      poseSessionId: 'pose-1',
      exerciseHint: 'Barbell Back Squat',
      starterCatalog: ['squat', 'push_up'],
      candidateProfiles: [
        {
          id: 'profile-1',
          canonical_name: 'squat',
          profile_kind: 'seed',
          landmark_signature: { left_shoulder: [0.1, 0.2] },
          angle_signature: { hip_knee_ankle: 92.4 },
          orientation_signature: { body_orientation: 'upright' },
          movement_pattern: { tracked_joint: 'knee_angle' },
          visibility_pattern: { min_visibility: 0.5 },
          rep_rules: { rep_start_angle: 88 },
        },
      ],
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      pose_session_id: string;
      starter_catalog: string[];
      candidate_profiles: Array<{ canonical_name: string }>;
    };

    expect(url).toBe('https://ai.fittrack.test/pose/session/bootstrap');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(body.starter_catalog).toEqual(['squat', 'push_up']);
    expect(body.candidate_profiles[0]?.canonical_name).toBe('squat');
    expect(result).toEqual({
      status: 'ready',
      accepted_fps: 15,
      subject_lock_mode: 'single_subject',
    });
  });

  it('posts pose-session finalize requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detected_exercise_name: 'squat',
          matched_profile_id: 'profile-1',
          classification_confidence: 0.94,
          subject_lock_confidence: 0.88,
          analysis_summary: {
            reps_detected: 12,
            form_feedback: ['Keep your chest up.'],
            average_confidence: 0.91,
            dominant_joint_angles: { hip_knee_ankle: 92.4 },
          },
          learned_profile: {
            canonical_name: 'squat',
            landmark_signature: { left_shoulder: [0.1, 0.2] },
            angle_signature: { hip_knee_ankle: 92.4 },
            orientation_signature: { body_orientation: 'upright' },
            movement_pattern: { tracked_joint: 'knee_angle' },
            visibility_pattern: { min_visibility: 0.5 },
            rep_rules: { rep_start_angle: 88 },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.finalizePoseSession({
      poseSessionId: 'pose-1',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as { pose_session_id: string };

    expect(url).toBe('https://ai.fittrack.test/pose/session/finalize');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(result).toEqual({
      detected_exercise_name: 'squat',
      matched_profile_id: 'profile-1',
      classification_confidence: 0.94,
      subject_lock_confidence: 0.88,
      analysis_summary: {
        reps_detected: 12,
        form_feedback: ['Keep your chest up.'],
        average_confidence: 0.91,
        dominant_joint_angles: { hip_knee_ankle: 92.4 },
      },
      learned_profile: {
        canonical_name: 'squat',
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: { hip_knee_ankle: 92.4 },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: { tracked_joint: 'knee_angle' },
        visibility_pattern: { min_visibility: 0.5 },
        rep_rules: { rep_start_angle: 88 },
      },
    });
  });

  it('rejects invalid pose bootstrap payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          accepted_fps: 0,
          subject_lock_mode: 'single_subject',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.bootstrapPoseSession({
        poseSessionId: 'pose-1',
        exerciseHint: null,
        starterCatalog: [],
        candidateProfiles: [],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('rejects invalid pose finalize payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detected_exercise_name: 'squat',
          matched_profile_id: null,
          classification_confidence: 0.94,
          subject_lock_confidence: 0.88,
          analysis_summary: {
            reps_detected: 12,
            form_feedback: ['Keep your chest up.'],
            average_confidence: 0.91,
            dominant_joint_angles: { hip_knee_ankle: '92.4' },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.finalizePoseSession({
        poseSessionId: 'pose-1',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts business insight requests to the dedicated Python analytics boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: 'Attendance softened late in the month.',
          highlights: ['Membership revenue remained stable.'],
          risks: ['Late-month check-ins declined.'],
          opportunities: ['Upsell high-performing plans during peak hours.'],
          anomaly_flags: ['Week four attendance dropped 18%.'],
          recommended_actions: ['Review class scheduling for the final week.'],
          token_count: 144,
          model_used: 'openrouter/model',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.generateBusinessInsight({
      grounding: {
        window: {
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          period: 'monthly',
          focus: 'overview',
        },
        overview: {
          total_revenue: '8849.00',
          total_check_ins: 342,
          new_members: 18,
          completed_coaching_sessions: 24,
        },
        revenue: {
          totals: {
            membership_revenue: '4999.00',
            booking_revenue: '1200.00',
            product_revenue: '850.00',
            coaching_payments_collected: '3000.00',
            coaching_gym_revenue: '1800.00',
            total_revenue: '8849.00',
          },
          series: [],
        },
        attendance: {
          series: [],
          peak_hours: [],
        },
        membership: {
          new_members: 18,
          active_members: 124,
          top_plans: [],
        },
        coaching: {
          coaches: [],
        },
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      grounding: {
        window: { focus: string; period: string };
      };
    };

    expect(url).toBe('https://ai.fittrack.test/analytics/insights');
    expect(init?.method).toBe('POST');
    expect(timeoutSpy).toHaveBeenCalledWith(45000);
    expect(body.grounding.window.focus).toBe('overview');
    expect(body.grounding.window.period).toBe('monthly');
    expect(result).toEqual({
      summary: 'Attendance softened late in the month.',
      highlights: ['Membership revenue remained stable.'],
      risks: ['Late-month check-ins declined.'],
      opportunities: ['Upsell high-performing plans during peak hours.'],
      anomaly_flags: ['Week four attendance dropped 18%.'],
      recommended_actions: ['Review class scheduling for the final week.'],
      token_count: 144,
      model_used: 'openrouter/model',
    });
    timeoutSpy.mockRestore();
  });

  it.each([
    ['detailed', ['overview'], {}, 85000],
    ['detailed', ['overview', 'revenue', 'overview'], {}, 125000],
    [
      'deep',
      [
        'overview',
        'revenue',
        'attendance',
        'membership',
        'coaching',
        'inventory',
        'overview',
      ],
      {},
      285000,
    ],
    ['deep', [], { overview: {}, revenue: {} }, 125000],
  ] as const)(
    'uses a finite depth-aware timeout for %s analysis',
    async (depth, selectedSections, sectionContexts, expectedTimeout) => {
      const configValues = {
        'ai.apiBaseUrl': 'https://ai.fittrack.test',
        'ai.requestTimeoutMs': 10000,
      };
      const config: Pick<ConfigService, 'get'> = {
        get: jest.fn(
          (key: string, fallback?: string | number) =>
            configValues[key as keyof typeof configValues] ?? fallback,
        ),
      };
      const fetchMock = jest.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            summary: 'Bounded insight.',
            highlights: [],
            risks: [],
            opportunities: [],
            anomaly_flags: [],
            recommended_actions: [],
          }),
          { status: 200 },
        ),
      );
      global.fetch = fetchMock;
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
      const service = new AiPythonClientService(config as ConfigService);

      await service.generateBusinessInsight(
        createBusinessInsightInput({
          analysis_depth: depth,
          selected_sections: [...selectedSections],
          section_contexts: { ...sectionContexts },
          data_fingerprint: 'fingerprint',
        }),
      );

      expect(timeoutSpy).toHaveBeenCalledWith(expectedTimeout);
    },
  );

  it('reports bounded validation paths and types for upstream HTTP 422 responses', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const oversizedPathPart = 'x'.repeat(220);
    const validationFields = [
      oversizedPathPart,
      'membership_card_revenue',
      'gym_membership_revenue',
      'cash_membership_revenue',
      'paymongo_membership_revenue',
      'series',
      'sixth_field',
    ];
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: validationFields.map((field) => ({
            loc: ['body', 'revenue', 'totals', field],
            msg: 'do-not-log-this-input-value',
            type: 'extra_forbidden',
          })),
        }),
        { status: 422 },
      ),
    );
    global.fetch = fetchMock;
    const service = new AiPythonClientService(config as ConfigService);

    const error = await service
      .generateBusinessInsight(createBusinessInsightInput())
      .then(
        () => null,
        (rejection: unknown) => rejection,
      );

    expect(error).toBeInstanceOf(HttpException);
    const response = (error as HttpException).getResponse() as {
      detail: string;
      status: number;
    };
    expect(response.status).toBe(502);
    expect(response.detail).toContain('upstream HTTP 422');
    expect(response.detail).toContain(
      'body.revenue.totals.membership_card_revenue [extra_forbidden]',
    );
    expect(response.detail).toContain(
      'body.revenue.totals.paymongo_membership_revenue [extra_forbidden]',
    );
    expect(response.detail).not.toContain(
      'body.revenue.totals.series [extra_forbidden]',
    );
    expect(response.detail).not.toContain('sixth_field');
    expect(response.detail).not.toContain(oversizedPathPart);
    expect(response.detail).not.toContain('do-not-log-this-input-value');
    expect(response.detail.length).toBeLessThanOrEqual(1200);
  });

  it.each([
    [401, 'not-json upstream body'],
    [503, JSON.stringify({ detail: 'sk-standalone-secret-key' })],
  ])(
    'returns a safe upstream status detail for malformed HTTP %s responses',
    async (status, body) => {
      const configValues = {
        'ai.apiBaseUrl': 'https://ai.fittrack.test',
        'ai.requestTimeoutMs': 10000,
      };
      const config: Pick<ConfigService, 'get'> = {
        get: jest.fn(
          (key: string, fallback?: string | number) =>
            configValues[key as keyof typeof configValues] ?? fallback,
        ),
      };
      const fetchMock = jest.fn<typeof fetch>();
      fetchMock.mockResolvedValue(new Response(body, { status }));
      global.fetch = fetchMock;
      const service = new AiPythonClientService(config as ConfigService);

      const error = await service
        .generateBusinessInsight(createBusinessInsightInput())
        .then(
          () => null,
          (rejection: unknown) => rejection,
        );

      expect(error).toBeInstanceOf(HttpException);
      const response = (error as HttpException).getResponse() as {
        detail: string;
      };
      expect(response.detail).toBe(
        'The AI business-insight service rejected the business-analytics request (upstream HTTP ' +
          status +
          ').',
      );
      expect(response.detail).not.toContain('upstream-secret-token');
      expect(response.detail).not.toContain('not-json');
    },
  );
  it('rejects malformed upstream business insight payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: '',
          highlights: [],
          risks: [],
          opportunities: [],
          anomaly_flags: [],
          recommended_actions: [],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.generateBusinessInsight({
        grounding: {
          window: {
            start_date: '2026-03-01',
            end_date: '2026-03-31',
            period: 'monthly',
            focus: 'overview',
          },
          overview: {
            total_revenue: '8849.00',
            total_check_ins: 342,
            new_members: 18,
            completed_coaching_sessions: 24,
          },
          revenue: {
            totals: {
              membership_revenue: '4999.00',
              booking_revenue: '1200.00',
              product_revenue: '850.00',
              coaching_payments_collected: '3000.00',
              coaching_gym_revenue: '1800.00',
              total_revenue: '8849.00',
            },
            series: [],
          },
          attendance: {
            series: [],
            peak_hours: [],
          },
          membership: {
            new_members: 18,
            active_members: 124,
            top_plans: [],
          },
          coaching: {
            coaches: [],
          },
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts outcome evaluations to the dedicated comparison boundary', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          score: 8,
          verdict: 'effective',
          explanation:
            'The later snapshot is consistent with the earlier recommendation.',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const service = new AiPythonClientService(config as ConfigService);
    const grounding = createBusinessInsightInput().grounding;

    const result = await service.evaluateBusinessInsightOutcome({
      previous: {
        summary: 'Earlier recommendation.',
        recommended_actions: ['Adjust attendance coverage.'],
        selected_sections: ['attendance'],
        grounding,
      },
      current: {
        selected_sections: ['attendance'],
        grounding,
      },
      comparison_context: {
        previous_created_at: '2026-09-21T01:00:00.000Z',
        current_created_at: '2026-09-21T01:35:00.000Z',
        elapsed_minutes: 35,
        analytics_snapshot_changed: false,
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    expect(calls[0]?.[0]).toBe(
      'https://ai.fittrack.test/analytics/insights/evaluate',
    );
    expect(calls[0]?.[1]?.method).toBe('POST');
    expect(timeoutSpy).toHaveBeenCalledWith(120000);
    const requestBody = JSON.parse(
      String(calls[0]?.[1]?.body),
    ) as BusinessInsightOutcomeEvaluationRequest;
    expect(requestBody.comparison_context).toEqual({
      previous_created_at: '2026-09-21T01:00:00.000Z',
      current_created_at: '2026-09-21T01:35:00.000Z',
      elapsed_minutes: 35,
      analytics_snapshot_changed: false,
    });
    expect(result).toEqual({
      score: 8,
      verdict: 'effective',
      explanation:
        'The later snapshot is consistent with the earlier recommendation.',
    });
  });

  it.each([
    ['an inconsistent score and verdict', 8, 'partially_effective'],
    ['a fractional score', 7.5, 'effective'],
  ])('rejects an outcome payload with %s', async (_label, score, verdict) => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          score,
          verdict,
          explanation: 'This outcome violates the integer score contract.',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const service = new AiPythonClientService(config as ConfigService);
    const grounding = createBusinessInsightInput().grounding;

    await expect(
      service.evaluateBusinessInsightOutcome({
        previous: {
          summary: 'Earlier recommendation.',
          recommended_actions: [],
          selected_sections: ['attendance'],
          grounding,
        },
        current: {
          selected_sections: ['attendance'],
          grounding,
        },
        comparison_context: {
          previous_created_at: '2026-09-21T01:00:00.000Z',
          current_created_at: '2026-09-21T01:35:00.000Z',
          elapsed_minutes: 35,
          analytics_snapshot_changed: false,
        },
      }),
    ).rejects.toThrow(HttpException);
  });
});
