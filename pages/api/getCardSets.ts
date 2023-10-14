import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { getAppDataCollection } from '@/app/mongodb';
import { CardSetState } from '@/app/appState';

export type GetCardSetsResponseData = {
  cardSets: CardSetState[] | null;
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetCardSetsResponseData>
) {
  const appDataColl = getAppDataCollection();

  // @ts-expect-error
  const allCardSetData = (await (await appDataColl.find()).toArray()) as {
    handId: string;
    appState: CardSetState;
  }[];

  console.log('allCardSetData', allCardSetData);

  const data = await kv.get<object>('appData');
  if (data) {
    res
      .status(200)
      .json({ cardSets: allCardSetData.map((d) => d.appState), message: 'ok' });
  } else {
    res.status(500).json({ message: 'no work', cardSets: null });
  }
}
