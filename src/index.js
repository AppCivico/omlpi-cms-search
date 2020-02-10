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
      ROW_TO_JSON(tags.*) AS tags
    ${tsRank}
    FROM artigos
    LEFT JOIN artigos_tags__tags_artigos
      ON artigos_tags__tags_artigos.artigo_id = artigos.id
    LEFT JOIN tags
      ON artigos_tags__tags_artigos.tag_id = tags.id
    ${tsQuery}
    ${cond}
    ${orderBy}
  `;

  return db.any(sqlQuery, [q]);
};

/**
  * Routes
  */
server.get('/search', (req, res, next) => {
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