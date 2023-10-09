import { MongoClient } from 'mongodb';

export const client = new MongoClient(process.env.MONGODB_URI!);

export const getAppDataCollection = () =>
  client.db('workshop').collection('app-data');
