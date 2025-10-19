import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { RouteManager } from '../../../src/route/RouteManager.js';
import { ConsoleLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';

describe('EnhancedRouteManager (v2 features)', () => {
  let routeManager: RouteManager;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger('error');
    routeManager = new RouteManager(logger, makeRng(12345));
  });

  describe('Route Graph Generation', () => {
    it('generates valid route graphs', () => {
      const result = routeManager.generateRouteGraph(12345);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const graph = result.value;
        expect(graph.nodes.length).toBeGreaterThan(0);
        expect(graph.connections.length).toBeGreaterThan(0);
        expect(graph.startNode).toBeDefined();
        expect(graph.endNode).toBeDefined();
        expect(graph.layers.length).toBeGreaterThanOrEqual(3);
        expect(graph.layers.length).toBeLessThanOrEqual(6);
      }
    });

    it('generates deterministic graphs for same seed', () => {
      // Use separate managers with same RNG seed to ensure determinism
      const manager1 = new RouteManager(logger, makeRng(99999));
      const manager2 = new RouteManager(logger, makeRng(99999));
      
      const result1 = manager1.generateRouteGraph(12345);
      const result2 = manager2.generateRouteGraph(12345);
      
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      
      if (result1.ok && result2.ok) {
        expect(result1.value.nodes.length).toBe(result2.value.nodes.length);
        expect(result1.value.connections.length).toBe(result2.value.connections.length);
        expect(result1.value.layers.length).toBe(result2.value.layers.length);
      }
    });

    it('generates different graphs for different seeds', () => {
      const graph1 = routeManager.generateRouteGraph(12345);
      const graph2 = routeManager.generateRouteGraph(54321);
      
      expect(graph1.ok).toBe(true);
      expect(graph2.ok).toBe(true);
      
      if (graph1.ok && graph2.ok) {
        // Different seeds should produce different structures
        const sameStructure = 
          graph1.value.nodes.length === graph2.value.nodes.length &&
          graph1.value.connections.length === graph2.value.connections.length;
        
        expect(sameStructure).toBe(false);
      }
    });

    it('first layer has battle nodes', () => {
      const result = routeManager.generateRouteGraph(12345);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const graph = result.value;
        const firstLayer = graph.layers[0];
        expect(firstLayer.length).toBe(1);
        
        const firstNode = graph.nodes.find(n => n.id === firstLayer[0]);
        expect(firstNode?.type).toBe('battle');
      }
    });

    it('last layer has boss nodes', () => {
      const result = routeManager.generateRouteGraph(12345);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const graph = result.value;
        const lastLayer = graph.layers[graph.layers.length - 1];
        expect(lastLayer.length).toBe(1);
        
        const lastNode = graph.nodes.find(n => n.id === lastLayer[0]);
        expect(lastNode?.type).toBe('boss');
      }
    });

    it('all nodes have required properties', () => {
      const result = routeManager.generateRouteGraph(12345);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const graph = result.value;
        for (const node of graph.nodes) {
          expect(node.id).toBeDefined();
          expect(node.type).toBeDefined();
          expect(node.position).toBeDefined();
          expect(node.position.x).toBeGreaterThanOrEqual(0);
          expect(node.position.y).toBeGreaterThanOrEqual(0);
          expect(node.difficulty).toBeGreaterThan(0);
          expect(node.rewards).toBeDefined();
          expect(node.rewards.gold).toBeGreaterThan(0);
          expect(node.description).toBeDefined();
        }
      }
    });

    it('property: graphs always have valid structure', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const result = routeManager.generateRouteGraph(seed);
          if (!result.ok) return false;
          
          const graph = result.value;
          
          // Must have nodes
          if (graph.nodes.length === 0) return false;
          
          // Must have start and end nodes
          const hasStart = graph.nodes.some(n => n.id === graph.startNode);
          const hasEnd = graph.nodes.some(n => n.id === graph.endNode);
          if (!hasStart || !hasEnd) return false;
          
          // Layer count must be in valid range
          if (graph.layers.length < 3 || graph.layers.length > 6) return false;
          
          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Route Visualization', () => {
    it('generates valid visualizations', () => {
      const graphResult = routeManager.generateRouteGraph(12345);
      expect(graphResult.ok).toBe(true);
      
      if (graphResult.ok) {
        const vizResult = routeManager.getRouteVisualization(graphResult.value);
        expect(vizResult.ok).toBe(true);
        
        if (vizResult.ok) {
          const viz = vizResult.value;
          expect(viz.svgPath).toBeDefined();
          expect(viz.nodePositions).toBeDefined();
          expect(viz.connections).toBeDefined();
          expect(viz.bounds.width).toBeGreaterThan(0);
          expect(viz.bounds.height).toBeGreaterThan(0);
        }
      }
    });

    it('node positions match graph nodes', () => {
      const graphResult = routeManager.generateRouteGraph(12345);
      expect(graphResult.ok).toBe(true);
      
      if (graphResult.ok) {
        const graph = graphResult.value;
        const vizResult = routeManager.getRouteVisualization(graph);
        expect(vizResult.ok).toBe(true);
        
        if (vizResult.ok) {
          const viz = vizResult.value;
          
          for (const node of graph.nodes) {
            const pos = viz.nodePositions[node.id];
            expect(pos).toBeDefined();
            expect(pos.x).toBe(node.position.x);
            expect(pos.y).toBe(node.position.y);
          }
        }
      }
    });

    it('connections have valid SVG paths', () => {
      const graphResult = routeManager.generateRouteGraph(12345);
      expect(graphResult.ok).toBe(true);
      
      if (graphResult.ok) {
        const graph = graphResult.value;
        const vizResult = routeManager.getRouteVisualization(graph);
        expect(vizResult.ok).toBe(true);
        
        if (vizResult.ok) {
          const viz = vizResult.value;
          
          for (const conn of viz.connections) {
            expect(conn.from).toBeDefined();
            expect(conn.to).toBeDefined();
            expect(conn.path).toMatch(/^M \d+ \d+ L \d+ \d+$/);
          }
        }
      }
    });
  });

  describe('Enhanced Choices', () => {
    it('generates enhanced choices with node types', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const result = await routeManager.getEnhancedChoices();
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const choices = result.value;
        expect(choices.length).toBe(3);
        
        for (const choice of choices) {
          expect(choice.nodeType).toBeDefined();
          expect(['battle', 'elite_battle', 'rest_site', 'shop', 'event', 'boss']).toContain(choice.nodeType);
          expect(choice.difficulty).toBeGreaterThan(0);
          expect(choice.rewards).toBeDefined();
          expect(choice.rewards.gold).toBeGreaterThan(0);
          expect(choice.rewards.experience).toBeGreaterThan(0);
          expect(choice.description).toBeDefined();
          expect(choice.visualPosition).toBeDefined();
          expect(choice.visualPosition.x).toBeGreaterThanOrEqual(0);
          expect(choice.visualPosition.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('enhanced choices are deterministic', async () => {
      const manager1 = new RouteManager(logger, makeRng(12345));
      const manager2 = new RouteManager(logger, makeRng(12345));
      
      await manager1.startRun('test-run', 12345);
      await manager2.startRun('test-run', 12345);
      
      const result1 = await manager1.getEnhancedChoices();
      const result2 = await manager2.getEnhancedChoices();
      
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      
      if (result1.ok && result2.ok) {
        const choices1 = result1.value;
        const choices2 = result2.value;
        
        expect(choices1.length).toBe(choices2.length);
        
        for (let i = 0; i < choices1.length; i++) {
          expect(choices1[i].nodeType).toBe(choices2[i].nodeType);
          expect(choices1[i].difficulty).toBe(choices2[i].difficulty);
          expect(choices1[i].rewards.gold).toBe(choices2[i].rewards.gold);
        }
      }
    });

    it('caches enhanced choices correctly', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const result1 = await routeManager.getEnhancedChoices();
      const result2 = await routeManager.getEnhancedChoices();
      
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      
      if (result1.ok && result2.ok) {
        // Should be the same reference (cached)
        expect(result1.value).toBe(result2.value);
      }
    });

    it('invalidates enhanced choice cache after choosing', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const choices1Result = await routeManager.getEnhancedChoices();
      expect(choices1Result.ok).toBe(true);
      
      if (choices1Result.ok) {
        const choiceId = choices1Result.value[0].id;
        await routeManager.choose(choiceId);
        
        const choices2Result = await routeManager.getEnhancedChoices();
        expect(choices2Result.ok).toBe(true);
        
        if (choices2Result.ok) {
          // Should be a new instance (cache invalidated)
          expect(choices1Result.value).not.toBe(choices2Result.value);
        }
      }
    });
  });

  describe('Node Type Distribution', () => {
    it('generates variety of node types', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const nodeTypes = new Set<string>();
      
      // Collect node types across multiple steps
      for (let i = 0; i < 5; i++) {
        const result = await routeManager.getEnhancedChoices();
        if (result.ok) {
          for (const choice of result.value) {
            nodeTypes.add(choice.nodeType);
          }
        }
        
        // Choose first option to advance
        const choicesResult = await routeManager.getChoices();
        if (choicesResult.ok && choicesResult.value.length > 0) {
          await routeManager.choose(choicesResult.value[0].id);
        }
      }
      
      // Should have seen multiple node types
      expect(nodeTypes.size).toBeGreaterThan(1);
    });
  });

  describe('Difficulty Scaling', () => {
    it('difficulty increases with step number', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const difficulties: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        const result = await routeManager.getEnhancedChoices();
        if (result.ok) {
          difficulties.push(result.value[0].difficulty);
        }
        
        const choicesResult = await routeManager.getChoices();
        if (choicesResult.ok && choicesResult.value.length > 0) {
          await routeManager.choose(choicesResult.value[0].id);
        }
      }
      
      // Difficulty should generally increase
      expect(difficulties[2]).toBeGreaterThan(difficulties[0]);
    });
  });

  describe('Reward Preview', () => {
    it('elite battles have higher rewards than normal battles', async () => {
      await routeManager.startRun('test-run', 12345);
      
      let normalBattle;
      let eliteBattle;
      
      // Search for both battle types
      for (let i = 0; i < 10; i++) {
        const result = await routeManager.getEnhancedChoices();
        if (result.ok) {
          for (const choice of result.value) {
            if (choice.nodeType === 'battle' && !normalBattle) {
              normalBattle = choice;
            }
            if (choice.nodeType === 'elite_battle' && !eliteBattle) {
              eliteBattle = choice;
            }
          }
        }
        
        if (normalBattle && eliteBattle) break;
        
        const choicesResult = await routeManager.getChoices();
        if (choicesResult.ok && choicesResult.value.length > 0) {
          await routeManager.choose(choicesResult.value[0].id);
        }
      }
      
      // If we found both types, elite should have higher rewards
      if (normalBattle && eliteBattle) {
        expect(eliteBattle.rewards.gold).toBeGreaterThan(normalBattle.rewards.gold);
      }
    });

    it('boss nodes have legendary items', async () => {
      const graphResult = routeManager.generateRouteGraph(12345);
      expect(graphResult.ok).toBe(true);
      
      if (graphResult.ok) {
        const graph = graphResult.value;
        const bossNodes = graph.nodes.filter(n => n.type === 'boss');
        
        for (const boss of bossNodes) {
          expect(boss.rewards.items).toContain('legendary_item');
        }
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('getChoices still works alongside getEnhancedChoices', async () => {
      await routeManager.startRun('test-run', 12345);
      
      const basicResult = await routeManager.getChoices();
      const enhancedResult = await routeManager.getEnhancedChoices();
      
      expect(basicResult.ok).toBe(true);
      expect(enhancedResult.ok).toBe(true);
      
      if (basicResult.ok && enhancedResult.ok) {
        expect(basicResult.value.length).toBe(enhancedResult.value.length);
        
        // IDs should match
        for (let i = 0; i < basicResult.value.length; i++) {
          expect(basicResult.value[i].id).toBe(enhancedResult.value[i].id);
        }
      }
    });
  });
});
