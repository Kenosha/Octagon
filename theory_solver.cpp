// Exhaustive, symmetry-reduced solver for both browser rulesets.
// This is intentionally dependency-free analysis code, not the production AI.
#include <algorithm>
#include <array>
#include <cstdint>
#include <deque>
#include <functional>
#include <fstream>
#include <iostream>
#include <queue>
#include <stdexcept>
#include <unordered_map>
#include <utility>
#include <vector>

using U32 = std::uint32_t;
using U64 = std::uint64_t;

static std::array<U32, 24> adjacent{};
static std::vector<U32> wins{};
static bool proper_ruleset = false;

static inline int mod8(int x) { return (x % 8 + 8) % 8; }
static inline U64 pack(U32 white, U32 black, bool black_to_move) {
    return U64(white) | (U64(black) << 24) | (U64(black_to_move) << 48);
}
static inline U32 white_of(U64 x) { return U32(x & 0xffffffu); }
static inline U32 black_of(U64 x) { return U32((x >> 24) & 0xffffffu); }
static inline bool black_turn(U64 x) { return (x >> 48) & 1u; }

static U32 transform_bits(U32 bits, int sign, int shift) {
    U32 out = 0;
    for (int ring = 0; ring < 3; ++ring) {
        for (int i = 0; i < 8; ++i) {
            if (bits & (U32(1) << (ring * 8 + i))) {
                // A reflected start-ring index is offset by one relative to
                // the inner/outer indexing (visible also from S_i's neighbor
                // set {i-1,i} on those rings).
                int j = mod8(sign * i + shift + (ring == 0 && sign == -1));
                out |= U32(1) << (ring * 8 + j);
            }
        }
    }
    return out;
}

static int transform_node(int node, int sign, int shift) {
    int ring = node / 8, i = node % 8;
    return ring * 8 + mod8(sign * i + shift + (ring == 0 && sign == -1));
}

static bool stabilizes_opening(int sign, int shift) {
    return ((shift + (sign == -1)) & 1) == 0;
}

static bool quotient_symmetry(int sign, int shift) {
    // The photographed four-crown family has quarter-turn symmetry but not
    // every reflection of the underlying eight-point movement graph.
    return stabilizes_opening(sign, shift) && (!proper_ruleset || sign == 1);
}

// Spatial symmetries that stabilize the colored initial position and turn:
// even rotations and the parity-preserving reflections. Color-swapping board
// automorphisms do not stabilize the initial side-to-move, so are deliberately
// excluded from this reachable-state quotient.
static U64 canonical(U64 state) {
    U32 w = white_of(state), b = black_of(state);
    bool bt = black_turn(state);
    U64 best = ~U64(0);
    for (int sign : {-1, 1}) {
        for (int shift = 0; shift < 8; ++shift) {
            U32 tw = transform_bits(w, sign, shift);
            U32 tb = transform_bits(b, sign, shift);
            if (quotient_symmetry(sign, shift))
                best = std::min(best, pack(tw, tb, bt));
        }
    }
    return best;
}

static bool has_win(U32 pieces) {
    for (U32 mask : wins) if ((pieces & mask) == mask) return true;
    return false;
}

static U32 choose_small(int n, int k) {
    if (k < 0 || k > n) return 0;
    if (k == 0 || k == n) return 1;
    U32 value = 1;
    for (int i = 1; i <= k; ++i) value = value * U32(n - k + i) / U32(i);
    return value;
}

static U32 rank_four(const std::array<int, 4>& values) {
    U32 rank = 0;
    for (int i = 0; i < 4; ++i) rank += choose_small(values[i], i + 1);
    return rank;
}

static std::vector<U32> build_white_prefix() {
    const U32 white_count = choose_small(20, 4);
    std::vector<U32> sizes(white_count, 0), prefix(white_count + 1, 0);
    for (int a = 0; a < 17; ++a) for (int b = a + 1; b < 18; ++b)
        for (int c = b + 1; c < 19; ++c) for (int d = c + 1; d < 20; ++d) {
            std::array<int, 4> values{a, b, c, d};
            int permanent_count = (a >= 4) + (b >= 4) + (c >= 4) + (d >= 4);
            sizes[rank_four(values)] = choose_small(20 - permanent_count, 4);
        }
    for (U32 i = 0; i < white_count; ++i) prefix[i + 1] = prefix[i] + sizes[i];
    return prefix;
}

static U32 dense_state_index(U64 state, const std::vector<U32>& white_prefix) {
    U32 white = white_of(state), black = black_of(state);
    std::array<int, 4> white_values{}, black_values{}, excluded{};
    int wi = 0, bi = 0, excluded_count = 0;
    for (int position = 0; position < 24; ++position) {
        if (white & (U32(1) << position)) {
            int local = position < 8 ? position / 2 : 4 + position - 8;
            white_values[wi++] = local;
            if (position >= 8) excluded[excluded_count++] = 4 + position - 8;
        }
    }
    for (int position = 0; position < 24; ++position) if (black & (U32(1) << position)) {
        int local = position < 8 ? (position - 1) / 2 : 4 + position - 8;
        int removed_before = 0;
        for (int i = 0; i < excluded_count; ++i) removed_before += excluded[i] < local;
        black_values[bi++] = local - removed_before;
    }
    if (wi != 4 || bi != 4) throw std::runtime_error("tablebase state does not contain four pieces per side");
    U32 white_rank = rank_four(white_values);
    U32 placement = white_prefix[white_rank] + rank_four(black_values);
    return placement * 2 + U32(black_turn(state));
}

static void write_u32(std::ofstream& output, U32 value) {
    char bytes[4] = {
        char(value & 0xff), char((value >> 8) & 0xff),
        char((value >> 16) & 0xff), char((value >> 24) & 0xff),
    };
    output.write(bytes, 4);
}

static void export_tablebase(const std::string& path, const std::vector<U64>& states,
                             const std::vector<std::uint8_t>& result,
                             const std::vector<U32>& distance, U32 maximum_distance) {
    if (!proper_ruleset) throw std::runtime_error("the compact browser tablebase currently supports only proper");
    if (maximum_distance >= 110) throw std::runtime_error("tablebase distance encoding needs more than one byte");
    auto white_prefix = build_white_prefix();
    U32 universe = white_prefix.back() * 2;
    std::vector<U32> presence((universe + 31) / 32, 0);
    std::vector<std::uint8_t> dense_values(universe, 0xff), payload;
    payload.reserve(states.size());
    for (U32 id = 0; id < states.size(); ++id) {
        U32 dense = dense_state_index(states[id], white_prefix);
        if (dense_values[dense] != 0xff) throw std::runtime_error("duplicate dense tablebase index");
        std::uint8_t encoded = result[id] == 0 ? 0
            : result[id] == 1 ? std::uint8_t(1 + distance[id])
            : std::uint8_t(110 + distance[id]);
        dense_values[dense] = encoded;
        presence[dense >> 5] |= U32(1) << (dense & 31);
    }
    for (std::uint8_t value : dense_values) if (value != 0xff) payload.push_back(value);
    if (payload.size() != states.size()) throw std::runtime_error("tablebase payload count mismatch");

    std::ofstream output(path, std::ios::binary);
    if (!output) throw std::runtime_error("cannot open tablebase output: " + path);
    const char magic[8] = {'O','C','T','B','P','R','1','\0'};
    output.write(magic, 8);
    write_u32(output, 1);                         // format version
    write_u32(output, universe);                  // dense state universe
    write_u32(output, U32(states.size()));        // canonical reachable entries
    write_u32(output, U32(white_prefix.size()));
    write_u32(output, U32(presence.size()));
    write_u32(output, maximum_distance);
    write_u32(output, U32(payload.size()));
    for (int i = 0; i < 7; ++i) write_u32(output, 0); // fixed 64-byte header
    for (U32 value : white_prefix) write_u32(output, value);
    for (U32 value : presence) write_u32(output, value);
    output.write(reinterpret_cast<const char*>(payload.data()), payload.size());
    if (!output) throw std::runtime_error("failed writing tablebase: " + path);
    std::cerr << "exported tablebase " << path << ": " << output.tellp() << " bytes\n";
}

static void print_indices(U32 pieces) {
    bool first = true;
    std::cout << "{";
    for (int i = 0; i < 24; ++i) if (pieces & (U32(1) << i)) {
        if (!first) std::cout << ",";
        std::cout << i;
        first = false;
    }
    std::cout << "}";
}

static std::vector<U64> successors(U64 state) {
    U32 w = white_of(state), b = black_of(state), occupied = w | b;
    if (has_win(w) || has_win(b)) return {};
    bool bt = black_turn(state);
    U32 own = bt ? b : w;
    std::vector<U64> out;
    while (own) {
        int from = __builtin_ctz(own);
        own &= own - 1;
        U32 dests = adjacent[from] & ~occupied;
        while (dests) {
            int to = __builtin_ctz(dests);
            dests &= dests - 1;
            U32 moved = (bt ? b : w) ^ (U32(1) << from) ^ (U32(1) << to);
            U64 next = bt ? pack(w, moved, false) : pack(moved, b, true);
            out.push_back(canonical(next));
        }
    }
    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

static bool find_move(U64 parent, U64 canonical_child, int& from_out, int& to_out, U64& raw_out) {
    U32 w = white_of(parent), b = black_of(parent), occupied = w | b;
    bool bt = black_turn(parent);
    U32 own = bt ? b : w;
    while (own) {
        int from = __builtin_ctz(own); own &= own - 1;
        U32 dests = adjacent[from] & ~occupied;
        while (dests) {
            int to = __builtin_ctz(dests); dests &= dests - 1;
            U32 moved = (bt ? b : w) ^ (U32(1) << from) ^ (U32(1) << to);
            U64 raw = bt ? pack(w, moved, false) : pack(moved, b, true);
            if (canonical(raw) == canonical_child) {
                from_out = from; to_out = to; raw_out = raw;
                return true;
            }
        }
    }
    return false;
}

static void setup(bool proper) {
    auto bit = [](int ring, int i) { return U32(1) << (ring * 8 + mod8(i)); };
    for (int i = 0; i < 8; ++i) {
        adjacent[i] = bit(1, i - 1) | bit(1, i) | bit(2, i - 1) | bit(2, i);
        if (proper) {
            U32 other_inner = 0;
            for (int j = 0; j < 8; ++j) if (j != i) other_inner |= bit(1, j);
            adjacent[8 + i] = other_inner | bit(2, i - 1) | bit(2, i) | bit(2, i + 1);
            adjacent[16 + i] = bit(1, i - 1) | bit(1, i) | bit(1, i + 1);
        } else {
            adjacent[8 + i] = bit(1, i - 1) | bit(1, i + 1) | bit(2, i - 1) | bit(2, i + 1);
            adjacent[16 + i] = bit(1, i - 1) | bit(1, i + 1);
        }
    }
    wins.clear();
    wins.push_back(bit(1, 0) | bit(1, 2) | bit(1, 4) | bit(1, 6));
    wins.push_back(bit(2, 0) | bit(2, 2) | bit(2, 4) | bit(2, 6));
    wins.push_back(bit(1, 1) | bit(1, 3) | bit(1, 5) | bit(1, 7));
    wins.push_back(bit(2, 1) | bit(2, 3) | bit(2, 5) | bit(2, 7));
    if (proper) {
        for (int center : {0, 2, 4, 6})
            wins.push_back(bit(1, center - 1) | bit(1, center + 1) |
                           bit(2, center - 1) | bit(2, center + 1));
        for (int i = 0; i < 4; ++i)
            wins.push_back(bit(1, i) | bit(1, i + 4) | bit(2, i) | bit(2, i + 4));
    } else {
        for (int i = 0; i < 8; ++i)
            wins.push_back(bit(1, i) | bit(1, i + 2) | bit(2, i) | bit(2, i + 2));
        for (int i = 0; i < 8; ++i)
            wins.push_back(bit(1, i) | bit(1, i + 1) | bit(2, i) | bit(2, i + 1));
    }
    for (int i = 0; i < 8; ++i)
        wins.push_back(bit(1, i + 1) | bit(1, i + 2) | bit(2, i) | bit(2, i + 3));
}

static void validate_translation_and_symmetries(U32 start_w, U32 start_b) {
    for (std::size_t a = 0; a < wins.size(); ++a)
        for (std::size_t b = a + 1; b < wins.size(); ++b)
            if (wins[a] == wins[b]) throw std::runtime_error("duplicate win mask");
    for (int sign : {-1, 1}) for (int shift = 0; shift < 8; ++shift) {
        if (!quotient_symmetry(sign, shift)) continue;
        if (transform_bits(start_w, sign, shift) != start_w ||
            transform_bits(start_b, sign, shift) != start_b)
            throw std::runtime_error("claimed symmetry does not stabilize opening");
        for (int node = 0; node < 24; ++node) {
            int mapped = transform_node(node, sign, shift);
            if (transform_bits(adjacent[node], sign, shift) != adjacent[mapped])
                throw std::runtime_error("claimed symmetry does not preserve moves");
        }
        for (U32 mask : wins) {
            U32 mapped = transform_bits(mask, sign, shift);
            if (std::find(wins.begin(), wins.end(), mapped) == wins.end())
                throw std::runtime_error("claimed symmetry does not preserve wins");
        }
    }
}

int main(int argc, char** argv) {
    std::string ruleset = "legacy";
    std::string tablebase_path;
    bool stalemate_is_loss = true;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "proper" || arg == "legacy") ruleset = arg;
        else if (arg == "stalemate-draw") stalemate_is_loss = false;
        else if (arg == "stalemate-loss") stalemate_is_loss = true;
        else if (arg.rfind("export-tablebase=", 0) == 0) tablebase_path = arg.substr(17);
        else throw std::runtime_error("usage: theory_solver [legacy|proper] [stalemate-draw|stalemate-loss] [export-tablebase=PATH]");
    }
    proper_ruleset = ruleset == "proper";
    setup(proper_ruleset);
    U32 start_w = 0, start_b = 0;
    for (int i = 0; i < 8; ++i) (i & 1 ? start_b : start_w) |= U32(1) << i;
    validate_translation_and_symmetries(start_w, start_b);
    U64 start = canonical(pack(start_w, start_b, false));

    std::vector<U64> states{start};
    std::vector<U32> parent{~U32(0)};
    std::unordered_map<U64, U32> ids;
    ids.reserve(3000000);
    ids.emplace(start, 0);
    std::vector<std::pair<U32, U32>> edges;
    std::vector<U32> outdegree;
    std::size_t terminals = 0, stalemates = 0, both_wins = 0;

    for (U32 at = 0; at < states.size(); ++at) {
        if ((at % 250000) == 0) std::cerr << "expanded " << at << " / " << states.size() << "\n";
        U64 s = states[at];
        bool ww = has_win(white_of(s)), bw = has_win(black_of(s));
        auto next = successors(s);
        outdegree.push_back(U32(next.size()));
        if (ww || bw) { ++terminals; if (ww && bw) ++both_wins; }
        else if (next.empty()) ++stalemates;
        for (U64 n : next) {
            auto [it, inserted] = ids.emplace(n, U32(states.size()));
            if (inserted) { states.push_back(n); parent.push_back(at); }
            edges.emplace_back(at, it->second);
        }
    }

    std::cerr << "states " << states.size() << ", edges " << edges.size()
              << ", terminal " << terminals << ", both-win " << both_wins
              << ", stalemate " << stalemates << "\n";

    std::vector<U32> indegree(states.size(), 0);
    for (auto [from, to] : edges) ++indegree[to];
    std::vector<U32> offsets(states.size() + 1, 0);
    for (std::size_t i = 0; i < states.size(); ++i) offsets[i + 1] = offsets[i] + indegree[i];
    std::vector<U32> cursor = offsets;
    std::vector<U32> reverse(edges.size());
    for (auto [from, to] : edges) reverse[cursor[to]++] = from;
    edges.clear(); edges.shrink_to_fit();

    // 0 unknown/draw, 1 win for player to move, 2 loss for player to move.
    std::vector<std::uint8_t> result(states.size(), 0);
    std::vector<U32> remaining = outdegree;
    std::deque<U32> queue;
    for (U32 i = 0; i < states.size(); ++i) {
        U64 s = states[i];
        bool ww = has_win(white_of(s)), bw = has_win(black_of(s));
        if (ww != bw) {
            bool winner_is_black = bw;
            result[i] = (winner_is_black == black_turn(s)) ? 1 : 2;
            queue.push_back(i);
        } else if (stalemate_is_loss && !ww && !bw && outdegree[i] == 0) {
            result[i] = 2; // chosen stalemate convention; count above reveals relevance
            queue.push_back(i);
        }
    }
    while (!queue.empty()) {
        U32 child = queue.front(); queue.pop_front();
        for (U32 p = offsets[child]; p < offsets[child + 1]; ++p) {
            U32 pred = reverse[p];
            if (result[pred] != 0) continue;
            if (result[child] == 2) {
                result[pred] = 1;
                queue.push_back(pred);
            } else if (--remaining[pred] == 0) {
                result[pred] = 2;
                queue.push_back(pred);
            }
        }
    }

    // Exact depth-to-win under optimal resistance. At a winning state the
    // player to move minimizes the distance; at a losing state they maximize
    // it. A min-priority queue ensures the first resolved losing child gives a
    // winning predecessor its shortest forced win.
    const U32 unresolved = ~U32(0);
    std::vector<U32> distance(states.size(), unresolved);
    std::vector<U32> distance_pending = outdegree;
    std::vector<U32> longest_child(states.size(), 0);
    using DistanceState = std::pair<U32, U32>;
    std::priority_queue<DistanceState, std::vector<DistanceState>, std::greater<DistanceState>> distance_queue;
    for (U32 i = 0; i < states.size(); ++i) {
        U64 s = states[i];
        bool terminal_win = has_win(white_of(s)) != has_win(black_of(s));
        bool terminal_loss_stalemate = stalemate_is_loss && !terminal_win && outdegree[i] == 0;
        if (result[i] == 2 && (terminal_win || terminal_loss_stalemate)) {
            distance[i] = 0;
            distance_queue.emplace(0, i);
        }
    }
    while (!distance_queue.empty()) {
        auto [child_distance, child] = distance_queue.top();
        distance_queue.pop();
        if (distance[child] != child_distance) continue;
        for (U32 p = offsets[child]; p < offsets[child + 1]; ++p) {
            U32 pred = reverse[p];
            if (distance[pred] != unresolved) continue;
            if (result[pred] == 1 && result[child] == 2) {
                distance[pred] = child_distance + 1;
                distance_queue.emplace(distance[pred], pred);
            } else if (result[pred] == 2 && result[child] == 1) {
                longest_child[pred] = std::max(longest_child[pred], child_distance);
                if (--distance_pending[pred] == 0) {
                    distance[pred] = longest_child[pred] + 1;
                    distance_queue.emplace(distance[pred], pred);
                }
            }
        }
    }
    for (U32 i = 0; i < states.size(); ++i) {
        if (result[i] != 0 && distance[i] == unresolved)
            throw std::runtime_error("failed to resolve depth-to-win");
    }
    U32 maximum_decisive_distance = 0;
    for (U32 i = 0; i < states.size(); ++i)
        if (result[i] != 0) maximum_decisive_distance = std::max(maximum_decisive_distance, distance[i]);
    if (!tablebase_path.empty())
        export_tablebase(tablebase_path, states, result, distance, maximum_decisive_distance);

    std::array<std::size_t, 3> counts{};
    for (auto r : result) ++counts[r];
    std::cout << "reachable canonical states: " << states.size() << "\n"
              << "ruleset: " << ruleset << "\n"
              << "winning patterns: " << wins.size() << "\n"
              << "canonical edges: " << reverse.size() << "\n"
              << "wins-to-move: " << counts[1] << "\n"
              << "losses-to-move: " << counts[2] << "\n"
              << "draws: " << counts[0] << "\n"
              << "maximum decisive depth: " << maximum_decisive_distance << " plies\n"
              << "stalemate convention: " << (stalemate_is_loss ? "loss" : "draw") << "\n"
              << "initial result: " << (result[0] == 1 ? "FIRST PLAYER WIN" : result[0] == 2 ? "FIRST PLAYER LOSS" : "DRAW") << "\n";

    if (result[0] != 0) {
        std::cout << "optimal decisive length: " << distance[0] << " plies\n";
        U64 actual = start;
        std::cout << "depth-optimal principal variation:\n";
        for (U32 ply = 0; ply < distance[0]; ++ply) {
            U32 current_id = ids.at(canonical(actual));
            U32 w = white_of(actual), b = black_of(actual), occupied = w | b;
            bool bt = black_turn(actual);
            U32 own = bt ? b : w;
            int best_from = -1, best_to = -1;
            U64 best_raw = 0;
            while (own) {
                int from = __builtin_ctz(own); own &= own - 1;
                U32 dests = adjacent[from] & ~occupied;
                while (dests) {
                    int to = __builtin_ctz(dests); dests &= dests - 1;
                    U32 moved = (bt ? b : w) ^ (U32(1) << from) ^ (U32(1) << to);
                    U64 raw = bt ? pack(w, moved, false) : pack(moved, b, true);
                    U32 child_id = ids.at(canonical(raw));
                    bool depth_optimal = result[child_id] == (result[current_id] == 1 ? 2 : 1)
                        && distance[child_id] + 1 == distance[current_id];
                    if (depth_optimal && (best_from < 0 || std::pair(from, to) < std::pair(best_from, best_to))) {
                        best_from = from; best_to = to; best_raw = raw;
                    }
                }
            }
            if (best_from < 0) throw std::runtime_error("failed to reconstruct depth-optimal line");
            std::cout << "  " << ply + 1 << ". " << (bt ? "black " : "white ")
                      << best_from << "->" << best_to << "\n";
            actual = best_raw;
        }
        std::cout << "  reached white="; print_indices(white_of(actual));
        std::cout << " black="; print_indices(black_of(actual));
        std::cout << " winner=" << (has_win(white_of(actual)) ? "white" : has_win(black_of(actual)) ? "black" : "none") << "\n";
    }

    std::cout << "reachable stalemates (0..7=S, 8..15=I, 16..23=O):\n";
    U32 first_stalemate = ~U32(0);
    for (U32 i = 0; i < states.size(); ++i) {
        U64 s = states[i];
        if (!has_win(white_of(s)) && !has_win(black_of(s)) && outdegree[i] == 0) {
            std::cout << "  id " << i << " white=";
            print_indices(white_of(s));
            std::cout << " black=";
            print_indices(black_of(s));
            std::cout << " turn=" << (black_turn(s) ? "black" : "white") << "\n";
            if (first_stalemate == ~U32(0)) first_stalemate = i;
        }
    }

    // Reconstruct an actual shortest path (the BFS parent tree lives in the
    // symmetry quotient, so carry the inverse symmetry between representatives).
    if (first_stalemate != ~U32(0)) {
        std::vector<U32> path;
        for (U32 x = first_stalemate; x != ~U32(0); x = parent[x]) path.push_back(x);
        std::reverse(path.begin(), path.end());
        std::array<int, 24> q{}; // maps current canonical representative -> actual orientation
        for (int i = 0; i < 24; ++i) q[i] = i;
        U64 actual = start;
        std::cout << "shortest path to a stalemate (" << path.size() - 1 << " plies):\n";
        for (std::size_t step = 0; step + 1 < path.size(); ++step) {
            U64 p = states[path[step]], child = states[path[step + 1]], raw;
            int from = -1, to = -1;
            if (!find_move(p, child, from, to, raw)) { std::cout << "  reconstruction failed\n"; break; }
            std::cout << "  " << step + 1 << ". " << (black_turn(actual) ? "black " : "white ")
                      << q[from] << "->" << q[to] << "\n";
            U32 aw = white_of(actual), ab = black_of(actual);
            if (black_turn(actual)) ab ^= (U32(1) << q[from]) | (U32(1) << q[to]);
            else aw ^= (U32(1) << q[from]) | (U32(1) << q[to]);
            actual = pack(aw, ab, !black_turn(actual));

            int gs = 0, gh = 0;
            bool found_g = false;
            for (int sign : {-1, 1}) for (int shift = 0; shift < 8; ++shift) {
                if (!quotient_symmetry(sign, shift)) continue;
                U64 tr = pack(transform_bits(white_of(raw), sign, shift),
                              transform_bits(black_of(raw), sign, shift), black_turn(raw));
                if (tr == child) { gs = sign; gh = shift; found_g = true; break; }
            }
            if (!found_g) { std::cout << "  symmetry reconstruction failed\n"; break; }
            int inverse_shift = mod8(-gs * gh);
            std::array<int, 24> next_q{};
            for (int i = 0; i < 24; ++i) next_q[i] = q[transform_node(i, gs, inverse_shift)];
            q = next_q;
        }
        std::cout << "  reached white="; print_indices(white_of(actual));
        std::cout << " black="; print_indices(black_of(actual));
        std::cout << " turn=" << (black_turn(actual) ? "black" : "white")
                  << " legal_moves=" << successors(actual).size() << "\n";
    }

    auto first = successors(start);
    std::cout << "initial canonical successor classes (move orbits):\n";
    for (U64 n : first) {
        U32 id = ids.at(n);
        int from = -1, to = -1;
        U64 raw = 0;
        find_move(start, n, from, to, raw);
        std::cout << "  " << from << "->" << to << " (state " << id << "): "
                  << (result[id] == 1 ? "opponent win" : result[id] == 2 ? "opponent loss" : "draw") << "\n";
    }
}
