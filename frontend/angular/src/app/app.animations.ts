import { animate, query, style, transition, trigger } from '@angular/animations';

export const listStagger = trigger('listStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('220ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ],
      { optional: true, limit: 12 },
    ),
  ]),
]);
