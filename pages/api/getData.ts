import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

type ResponseData =
  | {
      data: object;
    }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const data = await kv.get<object>('appData');
  if (data) {
    res.status(200).json({ data });
  } else {
    res.status(500).json({ error: 'no value found at key' });
  }
}
