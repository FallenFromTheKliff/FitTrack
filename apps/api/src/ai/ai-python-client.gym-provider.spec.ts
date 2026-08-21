import { ConfigService } from '@nestjs/config';

import { AiPythonClientService } from './ai-python-client.service';

describe('AiPythonClientService gym provider boundary', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('forwards only public gym context and bounded recent turns', async () => {
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
          reply: 'The gym opens at 06:00.',
          out_of_scope: false,
          sources: ['gym_identity'],
          follow_up_suggestions: [],
          model_used: 'primary-model',
          token_count: 17,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    await service.chatGym({
      sessionId: 'session-1',
      message: 'When do you open?',
      grounding: {
        operating_hours: [
          {
            day_of_week: 1,
            opens_at: '06:00',
            closes_at: '22:00',
            is_closed: false,
          },
          {
            day_of_week: 2,
            opens_at: '06:00',
            closes_at: '22:00',
            is_closed: false,
          },
        ],
        special_schedules: [
          {
            starts_on: '2026-12-24',
            ends_on: '2026-12-25',
            opens_at: '08:00',
            closes_at: '18:00',
            is_closed: false,
            reason: 'Holiday schedule',
          },
        ],
        promotions: [
          {
            title: 'Private promotion',
            description: 'Must not cross the provider boundary.',
            starts_at: '2026-01-01T00:00:00.000Z',
            ends_at: '2026-02-01T00:00:00.000Z',
          },
        ],
        faqs: [
          {
            category: 'general',
            question: 'Gym name',
            answer: 'SERTFIT Gym',
          },
          {
            category: 'general',
            question: 'Unrelated internal FAQ',
            answer: 'Must not cross the provider boundary.',
          },
        ],
        membership_plans: [
          {
            name: 'Private plan',
            price: '999',
            duration_days: 30,
          },
        ],
        session_history: [
          { role: 'user', content: 'one' },
          { role: 'assistant', content: 'two' },
          { role: 'user', content: 'three' },
          { role: 'assistant', content: 'four' },
          { role: 'user', content: 'five' },
        ],
        user_context: {
          first_name: 'Private',
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
    const init = calls[0]?.[1];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      session_id: string;
      message: string;
      grounding: Record<string, unknown>;
    };

    expect(body.session_id).toBe('session-1');
    expect(body.message).toBe('When do you open?');
    expect(body.grounding).toEqual({
      operating_hours: [
        {
          day_of_week: 1,
          opens_at: '06:00',
          closes_at: '22:00',
          is_closed: false,
        },
      ],
      special_schedules: [],
      promotions: [],
      faqs: [
        {
          category: 'general',
          question: 'Gym name',
          answer: 'SERTFIT Gym',
        },
      ],
      membership_plans: [],
      session_history: [
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
        { role: 'assistant', content: 'four' },
        { role: 'user', content: 'five' },
      ],
    });
    expect(body.grounding).not.toHaveProperty('user_context');
  });
});
