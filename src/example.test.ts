import {
  Collection,
  Entity,
  ManyToMany,
  ManyToOne,
  MikroORM,
  OneToMany,
  PrimaryKey,
  Property,
  Ref,
} from '@mikro-orm/sqlite';

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  @ManyToOne(() => User, { ref: true, nullable: true })
  parent?: Ref<User>;

  @OneToMany(() => User, (user) => user.parent)
  children = new Collection<User>(this);

  @OneToMany(() => Book, (book) => book.owner)
  ownedBooks = new Collection<Book>(this);

  @ManyToMany({
    entity: () => Book,
  })
  borrowedBooks = new Collection<Book>(this);
}

@Entity()
class Book {
  @PrimaryKey()
  id!: number;

  @Property()
  title!: string;

  @ManyToOne(() => User, { ref: true, nullable: true })
  owner!: Ref<User>;

  @Property({ nullable: true })
  deletedAt?: Date;
}

let orm: MikroORM;

beforeEach(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterEach(async () => {
  await orm.close(true);
});

test("filters child's books out", async () => {
  const parent = orm.em.create(User, {
    name: 'Parent',
    email: 'parent@example.com',
  });
  const child = orm.em.create(User, {
    name: 'Child',
    email: 'child@example.com',
    parent,
  });
  const book1 = orm.em.create(Book, { title: 'Book 1', owner: child });
  const book2 = orm.em.create(Book, {
    title: 'Book 2',
    owner: child,
    deletedAt: new Date(),
  });
  parent.borrowedBooks.add(book1, book2);
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(
    User,
    { name: 'Parent' },
    {
      populate: ['children.ownedBooks', 'borrowedBooks'],
      populateWhere: {
        children: {
          ownedBooks: {
            deletedAt: null,
          },
        },
      },
    },
  );

  expect(user.borrowedBooks.length).toBe(2);
  expect(user.children[0].ownedBooks.length).toBe(1);
});

test('filters boorowed books out', async () => {
  const parent = orm.em.create(User, {
    name: 'Parent',
    email: 'parent@example.com',
  });
  const child = orm.em.create(User, {
    name: 'Child',
    email: 'child@example.com',
    parent,
  });
  const book1 = orm.em.create(Book, { title: 'Book 1', owner: child });
  const book2 = orm.em.create(Book, {
    title: 'Book 2',
    owner: child,
    deletedAt: new Date(),
  });
  parent.borrowedBooks.add(book1, book2);
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(
    User,
    { name: 'Parent' },
    {
      populate: ['children.ownedBooks', 'borrowedBooks'],
      populateWhere: {
        borrowedBooks: {
          deletedAt: null,
        },
      },
    },
  );

  expect(user.borrowedBooks.length).toBe(1);
  expect(user.children[0].ownedBooks.length).toBe(2);
});
