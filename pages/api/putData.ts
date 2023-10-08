import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log('got req', req);
    await kv.set('appData', req.body);
    res.status(200).send({ message: 'ok' });
  } catch {
    res.status(500).send({ message: 'failed' });
  }
}
