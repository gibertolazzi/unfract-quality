import { Document } from '@/components/unfract/documentation/types';

export const MOCK_DOCS: Document[] = [
  {
    id: '1',
    title: '[Project] - August Development',
    manager: 'matteo',
    date: 'ago 17, 2026',
    company: 'GMF Labs',
    lastUpdate: 'today',
    blocks: [
      {
        id: 'b1',
        type: 'h2',
        content: 'Settimana 1'
      },
      {
        id: 'b2',
        type: 'p',
        content: 'The week began on Monday with a sprint planning session to define the priority goals for the release cycle. The backend team began migrating the authentication service to the new OAuth 2.1 standard, completing the rewrite of the endpoints and configuring short-lived JWT tokens. At the same time, the frontend team implemented the new analytics dashboard in React, integrating interactive charts and optimizing rendering for mobile devices.'
      },
      {
        id: 'b3',
        type: 'p',
        content: 'Midweek, on Wednesday, the DevOps team completed the update of the Kubernetes clusters in the staging environment and'
      },
      {
        id: 'b4',
        type: 'h2',
        content: 'Settimana 2'
      },
      {
        id: 'b5',
        type: 'p',
        content: 'Testing phase initiated for the new features. QA engineers identified several edge cases in the mobile rendering which were immediately patched.'
      },
      {
        id: 'b6',
        type: 'h2',
        content: 'Settimana 3'
      },
      {
        id: 'b7',
        type: 'p',
        content: 'Final preparations for deployment. Documentation updated to reflect changes in API contracts.'
      },
      {
        id: 'b8',
        type: 'h2',
        content: 'Settimana 4'
      },
      {
        id: 'b9',
        type: 'p',
        content: 'Rollout to production went smoothly. Monitoring dashboards show stable performance.'
      }
    ]
  },
  {
    id: '2',
    title: '[Project] - June Development',
    manager: 'matteo',
    date: 'jun 10, 2026',
    company: 'GMF Labs',
    lastUpdate: 'jun 30, 2026',
    blocks: []
  },
  {
    id: '3',
    title: '[Project] - May Development',
    manager: 'matteo',
    date: 'may 14, 2026',
    company: 'GMF Labs',
    lastUpdate: 'may 31, 2026',
    blocks: []
  },
  {
    id: '4',
    title: '[Project] - May Development',
    manager: 'matteo',
    date: 'apr 6, 2026',
    company: 'GMF Labs',
    lastUpdate: 'apr 30, 2026',
    blocks: []
  }
];
