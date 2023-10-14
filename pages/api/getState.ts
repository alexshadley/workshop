import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppDataCollection } from '../../app/mongodb';
import {
  CardSetState,
  getInitialState,
  StateUpdate,
  applyStateUpdates,
} from '@/app/appState';

export type GetStateResponseData = {
  message: string;
  appState: CardSetState | null;
};

export type GetStateRequestBody = {
  cardSetId: string;
  updates: StateUpdate[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetStateResponseData>
) {
  try {
    const appDataColl = getAppDataCollection();

    const body = JSON.parse(req.body) as GetStateRequestBody;

    const appData = await appDataColl.findOne({ handId: body.cardSetId });

    const appState = appData?.appState ?? getInitialState(body.cardSetId);
    applyStateUpdates(appState, body.updates);

    appDataColl.updateOne(
      { handId: body.cardSetId },
      {
        $set: {
          appState,
          handId: body.cardSetId,
        },
      },
      { upsert: true }
    );

    res.status(200).send({ message: 'ok', appState });
  } catch {
    res.status(500).send({ message: 'failed', appState: null });
  }
}
