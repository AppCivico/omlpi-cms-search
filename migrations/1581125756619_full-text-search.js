/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createExtension('unaccent', { ifNotExists: true });

  // Add the tsvector column
  pgm.addColumn('artigos',
    { tsv: { type: 'tsvector' } },
    { ifNotExists: true });

  // Create gin index on tsv column
  pgm.createIndex('artigos', 'tsv', {
    name: 'artigos_tsv_idx',
    method: 'gin',
  });

  // Helper function to update tsvector column by artigo_id
  pgm.createFunction(
    'f_artigos_tsv_update',
    [
      {
        name: '_artigo_id',
        type: 'int',
      },
    ],
    {
      returns: 'void',
      language: 'plpgsql',
      replace: true,
    },
    `declare
      tags_str varchar;
    begin

      select string_agg(unaccent(tags.name), ' ') into tags_str
      from artigos_tags__tags_artigos
      join tags
        on artigos_tags__tags_artigos.tag_id = tags.id
      where artigos_tags__tags_artigos.artigo_id = _artigo_id;

      update artigos
        set tsv = setweight(to_tsvector('portuguese', unaccent(title)), 'A')
               || setweight(to_tsvector('portuguese', concat_ws(' ', author, organization)), 'B')
               || setweight(to_tsvector('portuguese', coalesce(tags_str, '')), 'C')
      where id = _artigo_id;

    end;`,
  );
};

exports.down = pgm => {
  pgm.dropIndex('artigos', 'tsv', { name: 'artigos_tsv_idx' });
  pgm.dropColumn('artigos', 'tsv');
  pgm.dropFunction('f_artigos_tsv_update', [], { ifExists: true });
};
