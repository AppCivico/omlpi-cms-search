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
  let tsRank = '';
  let tsQuery = '';
  let whereCond = '';
  let orderBy = 'ORDER BY artigos.created_at DESC';

  if (q) {
    const hasWhiteSpace = q.includes(' ');

    tsQuery = hasWhiteSpace
      ? 'CROSS JOIN ( SELECT plainto_tsquery(\'portuguese\', unaccent($<q>)) AS query ) tsquery'
      : 'CROSS JOIN ( SELECT (plainto_tsquery(\'portuguese\', unaccent($<q>))::tsquery::text || \':*\')::tsquery AS query ) tsquery';

    tsRank = 'TS_RANK(tsv, query) AS rank,';
    whereCond = 'WHERE artigos.tsv @@ query';
    orderBy = 'ORDER BY rank DESC, created_at DESC';
  }

  const limit = parseInt(args.limit, 10) || 10;
  const offset = parseInt(args.offset, 10) || 0;

  const sqlQuery = `
     SELECT
      artigos.id,
      artigos.title,
      artigos.date,
      artigos.description,
      artigos.author,
      artigos.organization,
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
      ) AS tags,
      $<tsRank:raw>
      artigos.created_at,
      artigos.updated_at,
      (
        SELECT ROW_TO_JSON(upload_file.*)
        FROM (
          SELECT upload_file.*
          FROM upload_file
          JOIN upload_file_morph
            ON upload_file.id = upload_file_morph.upload_file_id
              AND upload_file_morph.related_type = 'artigos'
              AND upload_file_morph.field = 'file'
              AND upload_file_morph.related_id   = artigos.id
        ) upload_file
      ) AS file,
      (
        SELECT ROW_TO_JSON(upload_image.*)
        FROM (
          SELECT upload_file.*
          FROM upload_file
          JOIN upload_file_morph
            ON upload_file.id = upload_file_morph.upload_file_id
              AND upload_file_morph.related_type = 'artigos'
              AND upload_file_morph.field = 'image'
              AND upload_file_morph.related_id   = artigos.id
        ) upload_image
      ) AS image
    FROM artigos
    ${tsQuery}
    $<whereCond:raw>
    $<orderBy:raw>
    LIMIT $<limit> + 1
    OFFSET $<offset>
  `;

  // Retrieve results
  const results = await db.any(sqlQuery, {
    q,
    orderBy,
    whereCond,
    limit,
    offset,
    tsRank,
  });

  // Pagination flag
  const hasMore = Boolean(results[limit]);

  return {
    hasMore,
    limit,
    offset,
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
    return next();
  } catch (err) {
    console.log(err);
    return next(new errors.InternalServerError('Internal server error'));
  }
});

const port = 1337;
server.listen(port, () => {
  console.log('Listening on port %d', port);
});
