UPDATE event_templates
SET slot_config = jsonb_set(
    slot_config,
    '{slots}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN elem->>'name' = 'Food Service Counter' THEN
                    elem || '{"sales_config": {"items": [{"name": "Milk Pot", "price": 10}, {"name": "Rose Water", "price": 5}]}}'::jsonb
                WHEN elem->>'name' = 'Food Service Counter - Evening' THEN
                     elem || '{"sales_config": {"items": [{"name": "Milk Pot", "price": 10}, {"name": "Rose Water", "price": 5}]}}'::jsonb
                ELSE
                    elem
            END
        )
        FROM jsonb_array_elements(slot_config->'slots') AS elem
    )
)
WHERE name = 'Thaipusam Multi-Day Festival';
