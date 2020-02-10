const restify = require('restify');
const errors = require('restify-errors');
const pgp = require('pg-promise')();

/**
  * Initialize server
  */
const server = restify.createServer();
const db = pgp(process.env.DATABASE_URL);

/**
  * Middleware
  */
// server.use(restify.plugins.jsonp());
server.use(restify.plugins.queryParser());
server.pre(restify.plugins.pre.dedupeSlashes());

/**
  * Services
  */
const searchArtigos = (q) => {
  let cond = '';
  let tsRank = '';
  let tsQuery = '';
  let orderBy = 'ORDER BY artigos.created_at DESC';

  if (q) {
    const hasWhiteSpace = q.includes(' ');
    const plainToTsQuery = hasWhiteSpace
      ? 'plainto_tsquery(\'portuguese\', unaccent($1))'
      : '(plainto_tsquery(\'portuguese\', unaccent($1))::tsquery::text || \':*\')::tsquery';

    tsRank = ', ts_rank(tsv, query) as rank';
    tsQuery = `CROSS JOIN ( SELECT ${plainToTsQuery} AS query ) tsquery`;
    cond = 'WHERE artigos.tsv @@ query';
    orderBy = 'ORDER BY rank DESC, created_at DESC';
  }

  const sqlQuery = `
     SELECT
      artigos.id,
      artigos.title,
      artigos.description,
      artigos.author,
      artigos.organization,
      artigos.created_at,
      artigos.updated_at,
      COALESCE(
        (
          SELECT JSON_AGG(tags_agg.*)
          FROM (
            SELECT tags.id, tags.name, tags.created_at, tags.updated_at
            FROM artigos__tags
            JOIN tags
              ON artigos__tags.tag_id = tags.id
            WHERE artigos__tags.artigo_id = artigos.id
          ) tags_agg
        ),
        '[]'
      ) AS tags
    ${tsRank}
    FROM artigos
    ${tsQuery}
    ${cond}
    ${orderBy}
  `;

  console.log(sqlQuery);
  console.dir([q]);

  return db.any(sqlQuery, [q]);
};

/**
  * Routes
  */
server.get('/artigos', (req, res, next) => {
  const { q } = req.query;

  searchArtigos(q)
    .then((data) => {
      res.send(data.map(({ rank, ...keepAttrs }) => keepAttrs));
      next();
    })
    .catch((err) => {
      console.log(err);
      return next(new errors.InternalServerError('Internal server error'));
    });
});

const port = 1337;
server.listen(port, () => {
  console.log('Listening on port %d', port);
});
