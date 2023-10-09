import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppDataCollection } from '../../app/mongodb';
import {
  AppState,
  INITIAL_STATE,
  StateUpdate,
  applyStateUpdates,
} from '@/app/appState';

export type GetStateResponseData = {
  message: string;
  appState: AppState | null;
};

export type GetStateRequestBody = {
  updates: StateUpdate[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetStateResponseData>
) {
  try {
    const appDataColl = getAppDataCollection();

    const body = JSON.parse(req.body) as GetStateRequestBody;

    const appData = await appDataColl.findOne({ handId: 'the-only-hand' });

    const appState = appData?.appState ?? INITIAL_STATE;
    applyStateUpdates(appState, body.updates);

    appDataColl.updateOne(
      { handId: 'the-only-hand' },
      {
        $set: {
          appState,
          handId: 'the-only-hand',
        },
      },

      { upsert: true }
    );

    res.status(200).send({ message: 'ok', appState });
  } catch {
    res.status(500).send({ message: 'failed', appState: null });
  }
}
