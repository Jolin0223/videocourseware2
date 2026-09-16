window.BOBO_LESSON = {
  words: ['bean', 'egg', 'burger'],
  titles: ['Bobo’s Magic Lunch Truck', 'Lunch time!', 'Open and listen', 'More friends!', 'One or more?', 'Fill the basket', 'Make more burgers', 'Lunch orders', 'Match the name', 'Lunch is ready!'],
  orders: [
    { id: 'L01', word: 'bean', answer: ['bean', 1], options: [['bean', 1], ['bean', 3], ['egg', 1]] },
    { id: 'L02', word: 'eggs', answer: ['egg', 3], options: [['egg', 1], ['egg', 3], ['bean', 3]] },
    { id: 'L03', word: 'burgers', answer: ['burger', 3], options: [['burger', 3], ['burger', 1], ['egg', 3]] },
    { id: 'L04', word: 'egg', answer: ['egg', 1], options: [['egg', 3], ['burger', 1], ['egg', 1]] },
    { id: 'L05', word: 'beans', answer: ['bean', 3], options: [['burger', 3], ['bean', 1], ['bean', 3]] },
    { id: 'L06', word: 'burger', answer: ['burger', 1], options: [['burger', 1], ['bean', 1], ['burger', 3]] }
  ],
  labels: [{ kind: 'bean', count: 2, answer: 'beans' }, { kind: 'egg', count: 1, answer: 'egg' }, { kind: 'burger', count: 4, answer: 'burgers' }],
  checks: { bean: 'beans', egg: 'egg', burger: 'burgers' },
  captions: {
    S01: ["Here comes Bobo’s lunch truck! It’s lunch time!", 'Look at the lids!', "What's inside? Let's find out!"],
    S02: ["Hello! I'm Bobo.", 'Help me, please!'],
    S03: ['One friend. One lunch.', 'Oh! More friends!', 'We need more food!'],
    S04: ['More friends!', "Let's make more!"],
    S09: ['Lunch is ready!', 'Thank you, my friends!', "Let's say the words. Then let's eat!"]
  }
};
