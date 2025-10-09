import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';

const schema = a.schema({
  User: a.model({
    cognitoId: a.string().required(),
    firstName: a.string(),
    lastName: a.string(),
    username: a.string(),
    email: a.email().required(),
    profileImageKey: a.string(),
    address: a.customType({
      line1: a.string(),
      city: a.string(),
      state: a.string(),
      zip: a.string(),
      country: a.string(),
    }),
    vehicle: a.customType({
      make: a.string(),
      model: a.string(),
      color: a.string(),
      license: a.string(),
      year: a.integer(),
    }),
    emergencyContact: a.customType({
      name: a.string(),
      phone: a.string(),
      email: a.email(),
      address: a.string(),
    }),
    contactPrefs: a.customType({
      email: a.boolean(),
      push: a.boolean(),
    }),
    status: a.string(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    teams: a.hasMany('TeamMember', 'userCognitoId'),
    ledTeams: a.hasMany('Team', 'teamLeadCognitoId'),
    ticketsRequested: a.hasMany('Ticket', 'requesterId'),
    ticketsAssigned: a.hasMany('Ticket', 'assigneeId'),
    comments: a.hasMany('Comment', 'userCognitoId'),
    notifications: a.hasMany('Notification', 'userCognitoId'),
    channels: a.hasMany('UserChannel', 'userCognitoId'),
    messagesSent: a.hasMany('Message', 'senderCognitoId'),
    contacts: a.hasMany('Friend', 'ownerCognitoId'),
    friendsOf: a.hasMany('Friend', 'friendCognitoId'),
    invoicesFrom: a.hasMany('Invoice', 'billFromId'), 
    invoicesTo: a.hasMany('Invoice', 'billToId'),
  })
    .identifier(['cognitoId'])
    .secondaryIndexes(index => [index('email')])
    .authorization(allow => [
      allow.ownerDefinedIn('cognitoId').identityClaim('sub').to(['read', 'update', 'delete']),
      allow.authenticated().to(['create', 'read']),
    ]),

  PaymentMethod: a.model({
    userCognitoId: a.string().required(),
    type: a.string().required(),
    name: a.string().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .secondaryIndexes(index => [index('userCognitoId')])
    .authorization(allow => [allow.ownerDefinedIn('userCognitoId').identityClaim('sub')]),

  Friend: a.model({
    ownerCognitoId: a.string().required(),
    friendCognitoId: a.string().required(),
    addedAt: a.datetime().required(),
    owner: a.belongsTo('User', 'ownerCognitoId'),
    friend: a.belongsTo('User', 'friendCognitoId'),
  })
    .identifier(['ownerCognitoId', 'friendCognitoId'])
    .secondaryIndexes(index => [index('ownerCognitoId').sortKeys(['addedAt'])])
    .authorization(allow => [
      allow.ownerDefinedIn('ownerCognitoId').identityClaim('sub').to(['read', 'update', 'delete']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
      allow.authenticated().to(['create']),
    ]),

  Channel: a.model({
    name: a.string(),
    creatorCognitoId: a.string().required(),
    type: a.enum(['direct', 'group']),
    directKey: a.string(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    members: a.hasMany('UserChannel', 'channelId'),
    messages: a.hasMany('Message', 'channelId'),
  })
    .secondaryIndexes(index => [index('directKey')])
    .authorization(allow => [
      allow.ownerDefinedIn('creatorCognitoId').identityClaim('sub').to(['update', 'delete']),
      allow.authenticated().to(['create', 'read']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
    ]),

  UserChannel: a.model({
    userCognitoId: a.string().required(),
    channelId: a.id().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    user: a.belongsTo('User', 'userCognitoId'),
    channel: a.belongsTo('Channel', 'channelId'),
  })
    .identifier(['userCognitoId', 'channelId'])
    .secondaryIndexes(index => [index('userCognitoId'), index('channelId')])
    .authorization(allow => [
      allow.authenticated().to(['create', 'read']),
      allow.ownerDefinedIn('userCognitoId').identityClaim('sub').to(['update', 'delete']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
    ]),

  Message: a.model({
    content: a.string(),
    senderCognitoId: a.string().required(),
    channelId: a.id().required(),
    timestamp: a.datetime().required(),
    attachment: a.string(),
    readBy: a.string().array(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    sender: a.belongsTo('User', 'senderCognitoId'),
    channel: a.belongsTo('Channel', 'channelId'),
  })
    .secondaryIndexes(index => [index('channelId').sortKeys(['timestamp'])])
    .authorization(allow => [
      allow.authenticated().to(['create', 'read']),
      allow.ownerDefinedIn('senderCognitoId').identityClaim('sub').to(['update', 'delete']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
    ]),

  Team: a.model({
    name: a.string().required(),
    description: a.string(),
    teamLeadCognitoId: a.string().required(),
    teamLeadName: a.string(),
    memberCount: a.integer().default(0),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    teamLead: a.belongsTo('User', 'teamLeadCognitoId'),
    members: a.hasMany('TeamMember', 'teamId'),
    tickets: a.hasMany('Ticket', 'teamId'),
  }).authorization(allow => [
    allow.ownerDefinedIn('teamLeadCognitoId').identityClaim('sub').to(['read', 'update', 'delete']),
    allow.group('Admin').to(['create', 'read', 'update', 'delete']),
    allow.group('team_lead').to(['create', 'read']),
    allow.authenticated().to(['read']),
  ]),

  TeamMember: a.model({
    teamId: a.id().required(),
    userCognitoId: a.string().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    user: a.belongsTo('User', 'userCognitoId'),
    team: a.belongsTo('Team', 'teamId'),
  }).authorization(allow => [
    allow.group('Admin').to(['create', 'read', 'update', 'delete']),
    allow.group('team_lead').to(['create', 'read', 'update', 'delete']),
    allow.authenticated().to(['read']),
  ]),

  Ticket: a.model({
    id: a.id().required(),
    title: a.string().required(),
    description: a.string().required(),
    labels: a.string().array(),
    status: a.enum(['OPEN', 'QUEUED', 'IN_PROGRESS', 'COMPLETE', 'CLOSED', 'REOPENED']),
    estimated: a.date().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime(),
    startDate: a.datetime(),
    completionDate: a.datetime(),
    requesterId: a.string().required(),
    requester: a.belongsTo('User', 'requesterId'),
    assigneeId: a.string(),
    assignee: a.belongsTo('User', 'assigneeId'),
    teamId: a.id(),
    team: a.belongsTo('Team', 'teamId'),
    attachments: a.string().array(),
    comments: a.hasMany('Comment', 'ticketId'),
  })
    .authorization(allow => [
      allow.ownerDefinedIn('requesterId').identityClaim('sub'),
      allow.groups(['Admin', 'team_lead', 'member'])
    ]),

  Comment: a.model({
    content: a.string().required(),
    createdAt: a.datetime().required(),
    userCognitoId: a.string().required(),
    user: a.belongsTo('User', 'userCognitoId'),
    ticketId: a.id().required(),
    ticket: a.belongsTo('Ticket', 'ticketId'),
  })
    .authorization(allow => [
      allow.ownerDefinedIn('userCognitoId').identityClaim('sub'),
      allow.groups(['Admin', 'team_lead', 'member'])
    ]),

  Notification: a.model({
    content: a.string().required(),
    createdAt: a.datetime().required(),
    type: a.enum(['team', 'ticket', 'viewTeam']),
    nameType: a.string(),
    userCognitoId: a.string().required(),
    user: a.belongsTo('User', 'userCognitoId'),
    isRead: a.boolean().default(false),
  })
    .authorization(allow => [
      allow.ownerDefinedIn('userCognitoId').identityClaim('sub'),
      allow.groups(['Admin'])
    ]),

  Document: a.model({
    docId: a.id().required(),
    userCognitoId: a.string(),
    ownerIdentityId: a.string(),
    category: a.enum(['Audit', 'Budget', 'FinancialReports', 'Forms', 'Insurance', 'Certificates', 'Policies', 'Legal', 'Minutes', 'ReserveAnalysis', 'Statement', 'ViolationNotice']),
    subcategory: a.string(),
    fileName: a.string().required(),
    fileKey: a.string().required(),
    fileType: a.string().default('PDF'),
    description: a.string(),
    effectiveDate: a.date(),
    uploadDate: a.date().required(),
    expiryDate: a.date(),
    status: a.enum(['active', 'expired', 'archived']),
    version: a.integer().default(1),
    permissions: a.string().array().required(),
    tags: a.string().array(),
    size: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    tenantId: a.string(),
  })
    .identifier(['docId'])
    .secondaryIndexes(index => [
      index('category').sortKeys(['uploadDate']),
      index('expiryDate').sortKeys(['status']),
      index('userCognitoId').sortKeys(['category'])
    ])
    .authorization(allow => [
      allow.groupsDefinedIn('permissions').to(['read']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
      allow.group('Manager').to(['create', 'read', 'update', 'delete']),
      allow.group('team_lead').to(['read', 'update']),
      allow.group('User').to(['read']),
      allow.group('Facilities').to(['read'])
    ]),

  Transaction: a.model({
    transactionId: a.id().required(),
    accountId: a.string().required(),
    type: a.enum(['assessment', 'payment', 'charge', 'other']),
    date: a.date().required(),
    docNumber: a.string(),
    description: a.string(),
    chargeAmount: a.float(),
    paymentAmount: a.float(),
    balance: a.float().required(),
    confirmationNumber: a.string(),
    method: a.string(),
    status: a.enum(['paid', 'pending', 'overdue']),
    category: a.string(),
    recurringId: a.string(),
    reconciled: a.boolean().default(false),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    tenantId: a.string(),
    building: a.string(),
  })
    .identifier(['transactionId'])
    .secondaryIndexes(index => [
      index('accountId').sortKeys(['date']),
    ])
    .authorization(allow => [
      allow.ownerDefinedIn('accountId').identityClaim('sub').to(['read']),
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
      allow.group('Manager').to(['read', 'update']),
      allow.group('User').to(['read'])
    ]),

Invoice: a.model({
    invoiceId: a.id().required(),
    invoiceNumber: a.string().required(),
    date: a.date().required(),
    status: a.enum(['pending', 'open', 'closed']),
    billFromId: a.string().required(),
    billToId: a.string().required(),
    fromAddress: a.string(),
    toAddress: a.string(),
    description: a.string(),
    subtotal: a.float().required(),
    tax: a.float().required(),
    grandTotal: a.float().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    tenantId: a.string(),
    building: a.string(),
    billFrom: a.belongsTo('User', 'billFromId'),
    billTo: a.belongsTo('User', 'billToId'),
    items: a.hasMany('InvoiceItem', 'invoiceId'),
  })
    .identifier(['invoiceId'])
    .secondaryIndexes(index => [index('billToId').sortKeys(['date'])])  
    .authorization(allow => [
      allow.authenticated().to(['create']),
      allow.ownerDefinedIn('billFromId').identityClaim('sub').to(['read', 'update', 'delete']), 
      allow.ownerDefinedIn('billToId').identityClaim('sub').to(['read']),  
      allow.group('Admin').to(['create', 'read', 'update', 'delete']), 
      allow.group('Manager').to(['read', 'update']),
      allow.group('User').to(['read'])  
    ]),

InvoiceItem: a.model({
    invoiceItemId: a.id().required(),
    invoiceId: a.id().required(),
    name: a.string().required(),
    unitPrice: a.float().required(),
    units: a.integer().required(),
    total: a.float().required(),
    invoice: a.belongsTo('Invoice', 'invoiceId'),
  })
    .identifier(['invoiceItemId'])
    .secondaryIndexes(index => [index('invoiceId')])
    .authorization(allow => [
      allow.authenticated().to(['create']),  // NEW: Fallback for signed-in (secured by Invoice FK/index; allows Admin token)
      allow.group('Admin').to(['create', 'read', 'update', 'delete']),
      allow.group('Manager').to(['read', 'update']),
      allow.group('User').to(['read'])
    ]),

}).authorization(allow => [allow.resource(postConfirmation)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});