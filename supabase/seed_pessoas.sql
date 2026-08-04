-- Maza — seed de colaboradores fictícios para desenvolvimento.
-- Idempotente — usa NOT EXISTS pra evitar duplicação.
-- Vincula à unit Madonna SP Itaim (busca via brand slug).

INSERT INTO employees (unit_id, nome, sobrenome, funcao, salario_base, data_admissao, ativo)
SELECT u.id, 'Mariana', 'Costa', 'Garçonete', 2200.00, '2024-03-12', TRUE
FROM units u JOIN brands b ON b.id = u.brand_id
WHERE b.slug = 'madonna-cucina' AND u.name = 'Madonna SP Itaim'
  AND NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.unit_id = u.id
      AND e.nome = 'Mariana' AND e.sobrenome = 'Costa'
  );

INSERT INTO employees (unit_id, nome, sobrenome, funcao, salario_base, data_admissao, ativo)
SELECT u.id, 'Pedro', 'Alves', 'Cozinheiro', 2800.00, '2023-09-04', TRUE
FROM units u JOIN brands b ON b.id = u.brand_id
WHERE b.slug = 'madonna-cucina' AND u.name = 'Madonna SP Itaim'
  AND NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.unit_id = u.id
      AND e.nome = 'Pedro' AND e.sobrenome = 'Alves'
  );

INSERT INTO employees (unit_id, nome, sobrenome, funcao, salario_base, data_admissao, ativo)
SELECT u.id, 'Ana', 'Lima', 'Hostess', 1900.00, '2025-01-20', TRUE
FROM units u JOIN brands b ON b.id = u.brand_id
WHERE b.slug = 'madonna-cucina' AND u.name = 'Madonna SP Itaim'
  AND NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.unit_id = u.id
      AND e.nome = 'Ana' AND e.sobrenome = 'Lima'
  );

-- Verificação:
-- SELECT e.nome, e.sobrenome, e.funcao, e.salario_base, e.data_admissao, e.ativo
-- FROM employees e JOIN units u ON u.id = e.unit_id
-- WHERE u.name = 'Madonna SP Itaim' ORDER BY e.nome;
