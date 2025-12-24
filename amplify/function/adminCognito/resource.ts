import { defineFunction } from '@aws-amplify/backend';

export const adminCognito = defineFunction({
  name: 'adminCognito',
  environment: {
    REGION: process.env.AWS_REGION!,
  },
});
