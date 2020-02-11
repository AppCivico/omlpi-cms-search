const restify = require('restify');
const errors = require('restify-errors');
const pgp = require('pg-promise')();
const logger = require('morgan');

/**
  * Initialize server
  */
const server = restify.createServer();
const db = pgp(process.env.DATABASE_URL);

/**
  * Middlewares
  */
// server.use(restify.plugins.jsonp());
server.use(logger('dev'));
server.use(restify.plugins.queryParser());
server.pre(restify.plugins.pre.dedupeSlashes());

/**
  * Services
  */
const searchArtigos = async (q, args = {}) => {
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

  const limit = args.limit || 10;
  const offset = args.offset || 0;

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
    LIMIT ${limit} + 1
    OFFSET ${offset}
  `;

  // Retrieve results
  const results = await db.any(sqlQuery, [q]);

  // Pagination flag
  const hasMore = Boolean(results[limit]);

  return {
    hasMore,
    results: results
      .splice(0, limit)
      .map(({ rank, ...keepAttrs }) => keepAttrs),
  };
};

/**
  * Routes
  */
server.get('/artigos', async (req, res, next) => {
  const { _q, _limit, _offset } = req.query;

  try {
    const data = await searchArtigos(_q, { limit: _limit, offset: _offset });
    res.send(data);
    next();
  }
  catch (err) {
    console.log(err);
    return next(new errors.InternalServerError('Internal server error'));
  }
});

const port = 1337;
server.listen(port, () => {
  console.log('Listening on port %d', port);
});
