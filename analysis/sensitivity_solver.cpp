// Exact Octagon variant experiments. No changes to the shipped game/tablebase.
// g++ -O3 -std=c++17 analysis/sensitivity_solver.cpp -o /tmp/octagon_sensitivity
// /tmp/octagon_sensitivity [proper|local-inner|no-radial|outer-ring|deploy|pass|legacy] [variant-id|removals|additions]
// JSON Lines on stdout; progress on stderr. See SENSITIVITY.md for the method.
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>

using U8 = uint8_t;
using U16 = uint16_t;
using U32 = uint32_t;
using U64 = uint64_t;
constexpr U32 N = 4845, NONE = ~U32(0);
static U32 choose[21][5];
static int mod(int x) { return (x + 16) % 8; }
static U32 bit(int ring, int i) { return U32(1) << (ring * 8 + mod(i)); }
static U32 rank4(U32 bits) {
    U32 rank = 0; int k = 1;
    while (bits) { int p = __builtin_ctz(bits); bits &= bits - 1; rank += choose[p][k++]; }
    if (k != 5) throw std::runtime_error("not four pieces");
    return rank;
}
static U32 global(U32 local, int side) {
    U32 bits = (local >> 4) << 8;
    for (int i = 0; i < 4; ++i) if (local & (1u << i)) bits |= 1u << (2 * i + side);
    return bits;
}
static U32 local(U32 bits, int side) {
    U32 out = (bits >> 8) << 4;
    for (int i = 0; i < 4; ++i) if (bits & (1u << (2 * i + side))) out |= 1u << i;
    return out;
}
static U32 rotate(U32 bits, int shift) {
    U32 out = 0;
    for (int r = 0; r < 3; ++r) for (int i = 0; i < 8; ++i)
        if (bits & bit(r, i)) out |= bit(r, i + shift);
    return out;
}
struct Config { U32 local_bits, permanent; std::array<U16, 4> rotations; };
struct Placement { U16 white, black; };
struct Move { U16 config, destination; U8 from, to; };
struct RawMove { U32 child; U16 white, black; U8 from, to; };

struct Graph {
    std::vector<Config> configs = std::vector<Config>(N);
    std::vector<U32> mapping = std::vector<U32>(N * N, NONE);
    std::vector<Placement> placements;
    std::array<std::vector<Move>, N * 2> moves;
    std::vector<U32> offsets, reverse;
    std::vector<U8> degree;
    std::string mode;
    U32 start;

    explicit Graph(std::string movement) : mode(movement) {
        for (int n = 0; n <= 20; ++n) {
            choose[n][0] = 1;
            for (int k = 1; k <= 4; ++k)
                choose[n][k] = n == 0 ? 0 : choose[n-1][k-1] + choose[n-1][k];
        }
        for (int a = 0; a < 20; ++a) for (int b = a+1; b < 20; ++b)
            for (int c = b+1; c < 20; ++c) for (int d = c+1; d < 20; ++d) {
                U32 bits = (1u << a) | (1u << b) | (1u << c) | (1u << d);
                auto& conf = configs[rank4(bits)]; conf.local_bits = bits; conf.permanent = bits >> 4;
                for (int g = 0; g < 4; ++g)
                    conf.rotations[g] = rank4(local(rotate(global(bits, 0), 2*g), 0));
            }
        U64 legal = 0;
        for (U32 b = 0; b < N; ++b) for (U32 w = 0; w < N; ++w) {
            if (configs[w].permanent & configs[b].permanent) continue;
            ++legal;
            if (mapping[w + N*b] != NONE) continue;
            U32 id = placements.size(); placements.push_back({U16(w), U16(b)});
            for (int g = 0; g < 4; ++g)
                mapping[configs[w].rotations[g] + N*configs[b].rotations[g]] = id;
        }
        if (legal != 11099709) throw std::runtime_error("legal universe mismatch");
        start = state(0, 0, 0);

        std::array<U32, 24> adjacent{};
        for (int i = 0; i < 8; ++i) {
            adjacent[i] = bit(1,i-1) | bit(1,i) | bit(2,i-1) | bit(2,i);
            if (mode == "local-inner" || mode == "legacy")
                adjacent[8+i] = bit(1,i-1) | bit(1,i+1);
            else for (int j = 0; j < 8; ++j) if (j != i) adjacent[8+i] |= bit(1,j);
            adjacent[8+i] |= bit(2,i-1) | bit(2,i+1);
            adjacent[16+i] = bit(1,i-1) | bit(1,i+1);
            if (mode != "legacy" && mode != "no-radial") {
                adjacent[8+i] |= bit(2,i); adjacent[16+i] |= bit(1,i);
            }
            if (mode == "outer-ring") adjacent[16+i] |= bit(2,i-1) | bit(2,i+1);
        }
        // All experiments use the same four rotations. Validate both move
        // preservation. Quarter-turns also preserve each color's start points.
        for (int g = 0; g < 4; ++g) for (int p = 0; p < 24; ++p) {
            int q = p / 8 * 8 + mod(p % 8 + 2*g);
            if (rotate(adjacent[p],2*g) != adjacent[q]) throw std::runtime_error("invalid move symmetry");
        }
        for (int side = 0; side < 2; ++side) for (U32 id = 0; id < N; ++id) {
            U32 bits = global(configs[id].local_bits, side), sources = bits;
            if (mode == "deploy" && (bits & 255)) sources &= 255;
            while (sources) {
                int from = __builtin_ctz(sources); sources &= sources-1;
                U32 destinations = adjacent[from] & ~bits;
                while (destinations) {
                    int to = __builtin_ctz(destinations); destinations &= destinations-1;
                    U32 next = bits ^ (1u << from) ^ (1u << to);
                    moves[side*N+id].push_back({U16(rank4(local(next,side))), U16(1u << (to-8)), U8(from), U8(to)});
                }
            }
            if (mode == "pass") moves[side*N+id].push_back({U16(id), 0, 255, 255});
        }
        U32 size = placements.size() * 2;
        degree.resize(size); offsets.assign(size+1,0);
        std::array<U32, 48> next{};
        for (U32 at = 0; at < size; ++at) {
            U32 count = successors(at,next); degree[at] = count;
            for (U32 j = 0; j < count; ++j) ++offsets[next[j]+1];
        }
        std::partial_sum(offsets.begin(), offsets.end(), offsets.begin());
        reverse.resize(offsets.back());
        auto cursor = offsets;
        for (U32 at = 0; at < size; ++at) {
            U32 count = successors(at,next);
            for (U32 j = 0; j < count; ++j) reverse[cursor[next[j]]++] = at;
        }
        std::cerr << mode << ": " << size << " universe states, " << reverse.size() << " edges\n";
    }
    U32 state(U32 white, U32 black, int side) const {
        U32 id = mapping[white+N*black];
        if (id == NONE) throw std::runtime_error("overlapping pieces");
        return 2*id+side;
    }
    U32 successors(U32 at, std::array<U32,48>& next) const {
        const auto p = placements[at/2]; int side = at&1;
        U32 own = side ? p.black : p.white;
        U32 occupied = configs[side ? p.white : p.black].permanent;
        U32 count = 0;
        for (const auto& move : moves[side*N+own]) {
            if (move.destination & occupied) continue;
            next[count++] = state(side ? p.white : move.config, side ? move.config : p.black, !side);
        }
        std::sort(next.begin(),next.begin()+count);
        return std::unique(next.begin(),next.begin()+count)-next.begin();
    }
    std::vector<RawMove> raw_moves(U16 white, U16 black, int side) const {
        std::vector<RawMove> out;
        for (const auto& move : moves[side*N+(side ? black : white)]) {
            if (move.destination & configs[side ? white : black].permanent) continue;
            U16 w = side ? white : move.config, b = side ? move.config : black;
            out.push_back({state(w,b,!side), w,b,move.from,move.to});
        }
        std::sort(out.begin(), out.end(), [](auto a, auto b) {
            return std::pair(a.from,a.to) < std::pair(b.from,b.to);
        });
        return out;
    }
};

struct Variant { std::string id; std::vector<U32> patterns; };
static std::vector<U32> unique(std::vector<U32> patterns) {
    std::sort(patterns.begin(),patterns.end());
    patterns.erase(std::unique(patterns.begin(),patterns.end()),patterns.end());
    return patterns;
}
static std::vector<Variant> variants(const std::string& mode) {
    std::array<std::vector<U32>,4> base;
    for (int p=0;p<2;++p) for (int r=1;r<=2;++r)
        base[0].push_back(bit(r,p)|bit(r,p+2)|bit(r,p+4)|bit(r,p+6));
    for (int c : {0,2,4,6}) base[1].push_back(bit(1,c-1)|bit(1,c+1)|bit(2,c-1)|bit(2,c+1));
    for (int i=0;i<4;++i) base[2].push_back(bit(1,i)|bit(1,i+4)|bit(2,i)|bit(2,i+4));
    for (int i=0;i<8;++i) base[3].push_back(bit(1,i+1)|bit(1,i+2)|bit(2,i)|bit(2,i+3));
    auto subset = [&](int mask) {
        std::vector<U32> p;
        for (int j=0;j<4;++j) if (mask & (1<<j)) p.insert(p.end(),base[j].begin(),base[j].end());
        return unique(p);
    };
    auto original = subset(15);
    std::vector<Variant> out{{"original",original}};
    std::vector<U32> other_crowns, boxes, inner_arcs, outer_arcs, opposite_pairs;
    for (int c : {1,3,5,7}) other_crowns.push_back(bit(1,c-1)|bit(1,c+1)|bit(2,c-1)|bit(2,c+1));
    for (int i=0;i<8;++i) {
        boxes.push_back(bit(1,i)|bit(1,i+1)|bit(2,i)|bit(2,i+1));
        inner_arcs.push_back(bit(1,i)|bit(1,i+1)|bit(1,i+2)|bit(1,i+3));
        outer_arcs.push_back(bit(2,i)|bit(2,i+1)|bit(2,i+2)|bit(2,i+3));
    }
    std::vector<U32> diameters;
    for (int r=1;r<=2;++r) for (int i=0;i<4;++i) diameters.push_back(bit(r,i)|bit(r,i+4));
    for (int a=0;a<8;++a) for (int b=a+1;b<8;++b) opposite_pairs.push_back(diameters[a]|diameters[b]);
    auto add = [&](std::string id, std::vector<U32> extra) {
        extra.insert(extra.end(), original.begin(), original.end()); out.push_back({id,unique(extra)});
    };
    if (mode == "proper") {
        const char* letters="KCSD";
        for (int mask=1;mask<15;++mask) {
            std::string id="only-";
            for (int j=0;j<4;++j) if (mask & (1<<j)) id += letters[j];
            out.push_back({id,subset(mask)});
        }
        add("add-four-crowns",other_crowns);
        add("add-boxes",boxes);
        add("add-inner-arcs",inner_arcs);
        add("add-outer-arcs",outer_arcs);
        auto arcs=inner_arcs; arcs.insert(arcs.end(),outer_arcs.begin(),outer_arcs.end());
        add("add-both-arcs",arcs);
        add("add-opposite-pairs",opposite_pairs);
        out.push_back({"only-opposite-pairs",unique(opposite_pairs)});
        auto symmetric = subset(13); symmetric.insert(symmetric.end(),other_crowns.begin(),other_crowns.end());
        out.push_back({"rotate-crowns",unique(symmetric)});
        out.push_back({"only-boxes",unique(boxes)});
        std::vector<U32> ring;
        for(int r=1;r<=2;++r) for(int a=0;a<8;++a) for(int b=a+1;b<8;++b)
            for(int c=b+1;c<8;++c) for(int d=c+1;d<8;++d)
                ring.push_back(bit(r,a)|bit(r,b)|bit(r,c)|bit(r,d));
        out.push_back({"only-same-ring",unique(ring)});
    }
    if (mode == "legacy" || mode == "proper") {
        auto legacy = subset(11);
        legacy.insert(legacy.end(),other_crowns.begin(),other_crowns.end());
        legacy.insert(legacy.end(),boxes.begin(),boxes.end());
        out.push_back({"legacy-targets",unique(legacy)});
    }
    if (mode == "proper") {
        const char* letters="KCSD";
        for(int mask : {2,3,6,7,10,11,14}) {
            auto p=subset(mask); p.insert(p.end(),other_crowns.begin(),other_crowns.end());
            std::string id="symmetric-only-";
            for(int j=0;j<4;++j) if(mask & (1<<j)) id+=letters[j];
            out.push_back({id,unique(p)});
        }
        auto drop = [&](const std::string& id,const std::vector<U32>& removed) {
            auto p=original;
            p.erase(std::remove_if(p.begin(),p.end(),[&](U32 mask) {
                return std::find(removed.begin(),removed.end(),mask)!=removed.end();
            }),p.end());
            out.push_back({"drop-"+id,p});
        };
        drop("inner-even-square",{base[0][0]});
        drop("outer-even-square",{base[0][1]});
        drop("inner-odd-square",{base[0][2]});
        drop("outer-odd-square",{base[0][3]});
        drop("inner-squares",{base[0][0],base[0][2]});
        drop("outer-squares",{base[0][1],base[0][3]});
        drop("even-axes",{base[2][0],base[2][2]});
        drop("odd-axes",{base[2][1],base[2][3]});
        drop("even-diagonals",{base[3][0],base[3][2],base[3][4],base[3][6]});
        drop("odd-diagonals",{base[3][1],base[3][3],base[3][5],base[3][7]});
    }
    return out;
}

static void print_bits(U32 bits) {
    std::cout << '['; bool comma=false;
    while(bits) { int p=__builtin_ctz(bits); bits&=bits-1; if(comma) std::cout<<','; comma=true; std::cout<<p; }
    std::cout << ']';
}
static const char* outcome(U8 r) { return r==1 ? "win" : r==2 ? "loss" : "draw"; }

static void solve(const Graph& g, const Variant& variant) {
    auto began = std::chrono::steady_clock::now();
    const U32 size = g.degree.size();
    auto patterns = unique(variant.patterns);
    for(U32 mask:patterns) {
        if (__builtin_popcount(mask)!=4 || (mask&255)) throw std::runtime_error("invalid pattern");
        for(int rot=0;rot<4;++rot)
            if(!std::binary_search(patterns.begin(),patterns.end(),rotate(mask,2*rot)))
                throw std::runtime_error("invalid target symmetry");
    }
    std::array<U8,N> winning{};
    for (U32 c=0;c<N;++c) winning[c]=std::binary_search(patterns.begin(),patterns.end(),global(g.configs[c].local_bits,0));
    std::vector<U8> result(size,0), terminal(size,0), remaining=g.degree;
    std::vector<U32> distance(size,NONE), queue; queue.reserve(size);
    for(U32 id=0;id<size;++id) {
        auto p=g.placements[id/2]; bool w=winning[p.white], b=winning[p.black];
        terminal[id]=w||b;
        if(w != b) { result[id]=int(b)==int(id&1) ? 1 : 2; distance[id]=0; queue.push_back(id); }
    }
    // A FIFO processes distances in ascending order: a winning predecessor is
    // resolved by its first losing child; a losing predecessor by its last
    // winning child. Consequently W/D/L and minimax distance are solved together.
    U32 last_distance=0;
    for(U32 q=0;q<queue.size();++q) {
        U32 child=queue[q];
        if(distance[child]<last_distance) throw std::runtime_error("distance queue is not ordered");
        last_distance=distance[child];
        for(U32 e=g.offsets[child];e<g.offsets[child+1];++e) {
            U32 pred=g.reverse[e];
            if(result[pred] || terminal[pred]) continue;
            if(result[child]==2) { result[pred]=1; distance[pred]=distance[child]+1; queue.push_back(pred); }
            else if(--remaining[pred]==0) { result[pred]=2; distance[pred]=distance[child]+1; queue.push_back(pred); }
        }
    }
    // Reachability stops immediately at the variant's terminal states. It is
    // recomputed for every variant; the original terminal graph is not reused.
    queue.clear(); queue.push_back(g.start);
    std::vector<U8> seen(size,0); seen[g.start]=1;
    std::array<U32,48> next{};
    U64 edge_count=0, terminals=0, both=0, stalemates=0;
    std::array<U64,3> counts{}; U32 max_distance=0;
    for(U32 q=0;q<queue.size();++q) {
        U32 at=queue[q]; ++counts[result[at]];
        if(result[at]) max_distance=std::max(max_distance,distance[at]);
        if(terminal[at]) {
            ++terminals; auto p=g.placements[at/2]; both+=winning[p.white]&&winning[p.black]; continue;
        }
        U32 count=g.successors(at,next); edge_count+=count; stalemates+=count==0;
        // Full Bellman audit on every reachable nonterminal state, including
        // draws and distance minima/maxima. Recomputes all forward successors.
        bool has_loss=false, all_win=count>0, has_draw=false;
        U32 min_loss=NONE, max_win=0;
        for(U32 j=0;j<count;++j) {
            U32 child=next[j];
            if(!seen[child]) { seen[child]=1; queue.push_back(child); }
            has_loss|=result[child]==2; all_win&=result[child]==1; has_draw|=result[child]==0;
            if(result[child]==2) min_loss=std::min(min_loss,distance[child]);
            if(result[child]==1) max_win=std::max(max_win,distance[child]);
        }
        U8 expected=has_loss ? 1 : all_win ? 2 : 0;
        if(result[at]!=expected || (result[at]==1 && distance[at]!=min_loss+1) ||
            (result[at]==2 && distance[at]!=max_win+1) || (result[at]==0 && count && !has_draw))
            throw std::runtime_error("Bellman audit failed");
    }
    if(both) throw std::runtime_error("reachable simultaneous win");
    std::cout << "{\"movement\":\""<<g.mode<<"\",\"id\":\""<<variant.id<<"\",\"patterns\":[";
    for(U32 i=0;i<patterns.size();++i) { if(i) std::cout<<','; print_bits(patterns[i]); }
    std::cout<<"],\"states\":"<<queue.size()<<",\"edges\":"<<edge_count
        <<",\"wins\":"<<counts[1]<<",\"losses\":"<<counts[2]<<",\"draws\":"<<counts[0]
        <<",\"terminals\":"<<terminals<<",\"stalemates\":"<<stalemates
        <<",\"maximumDistance\":"<<max_distance<<",\"outcome\":\""<<outcome(result[g.start])<<"\",\"distance\":";
    if(result[g.start]) std::cout<<distance[g.start]; else std::cout<<"null";
    std::cout<<",\"opening\":["; bool comma=false;
    for(auto move:g.raw_moves(0,0,0)) {
        if(comma) std::cout<<',';
        comma=true;
        std::cout<<"{\"from\":"<<int(move.from)<<",\"to\":"<<int(move.to)<<",\"outcome\":\""
            <<outcome(result[move.child]==1 ? 2 : result[move.child]==2 ? 1 : 0)<<"\",\"distance\":";
        if(result[move.child]) std::cout<<distance[move.child]+1; else std::cout<<"null";
        std::cout<<'}';
    }
    std::cout<<"],\"pv\":[";
    // Lexicographic tie-breaking fixes one reproducible depth-optimal line.
    U16 white=0,black=0; int side=0; U32 at=g.start;
    for(U32 ply=0;result[g.start] && ply<distance[g.start];++ply) {
        auto moves=g.raw_moves(white,black,side);
        std::array<U32,3> options{}; U32 optimal=0; const RawMove* selected=nullptr;
        for(const auto& move:moves) {
            ++options[result[move.child]==1 ? 2 : result[move.child]==2 ? 1 : 0];
            if(result[move.child]==(result[at]==1 ? 2 : 1) && distance[move.child]+1==distance[at]) {
                ++optimal; if(!selected) selected=&move;
            }
        }
        if(!selected) throw std::runtime_error("PV reconstruction failed");
        if(ply) std::cout<<',';
        std::cout<<"{\"side\":"<<side<<",\"from\":"<<int(selected->from)<<",\"to\":"<<int(selected->to)
            <<",\"white\":"; print_bits(global(g.configs[white].local_bits,0));
        std::cout<<",\"black\":"; print_bits(global(g.configs[black].local_bits,1));
        std::cout<<",\"winMoves\":"<<options[1]<<",\"drawMoves\":"<<options[0]<<",\"lossMoves\":"<<options[2]
            <<",\"distanceOptimalMoves\":"<<optimal<<'}';
        white=selected->white; black=selected->black; at=selected->child; side^=1;
    }
    std::cout<<"],\"finalWhite\":"; print_bits(global(g.configs[white].local_bits,0));
    std::cout<<",\"finalBlack\":"; print_bits(global(g.configs[black].local_bits,1));
    // Independent cross-engine samples, only for the existing family rules.
    if(g.mode=="proper" && variant.id=="original") {
        std::cout<<",\"auditSamples\":[";
        U32 random=0x5eed1234;
        for(U32 i=0;i<2048;++i) {
            random=random*1664525u+1013904223u; U32 id=queue[random%queue.size()]; auto p=g.placements[id/2];
            if(i) std::cout<<',';
            std::cout<<"{\"white\":"; print_bits(global(g.configs[p.white].local_bits,0));
            std::cout<<",\"black\":"; print_bits(global(g.configs[p.black].local_bits,1));
            std::cout<<",\"side\":"<<(id&1)<<",\"outcome\":\""<<outcome(result[id])<<"\",\"distance\":";
            if(result[id]) std::cout<<distance[id]; else std::cout<<"null";
            std::cout<<'}';
        }
        std::cout<<']';
    }
    double seconds=std::chrono::duration<double>(std::chrono::steady_clock::now()-began).count();
    std::cout<<",\"seconds\":"<<seconds<<",\"bellmanAudit\":true}\n"<<std::flush;
    std::cerr<<g.mode<<'/'<<variant.id<<": "<<outcome(result[g.start])<<' '
        <<(result[g.start] ? std::to_string(distance[g.start]) : "-")<<" plies, "<<seconds<<" s\n";
}

int main(int argc,char** argv) {
    std::string mode=argc>1 ? argv[1] : "proper", filter=argc>2 ? argv[2] : "";
    const std::vector<std::string> valid={"proper","local-inner","no-radial","outer-ring","deploy","pass","legacy"};
    if(std::find(valid.begin(),valid.end(),mode)==valid.end() || argc>3) throw std::runtime_error("unknown movement/arguments");
    auto experiments=variants(mode);
    bool group=mode=="proper" && (filter=="removals" || filter=="additions" ||
        filter=="symmetric-subsets" || filter=="fine-removals");
    if(!filter.empty() && !group && std::none_of(experiments.begin(),experiments.end(),[&](auto v){return v.id==filter;}))
        throw std::runtime_error("unknown variant");
    Graph graph(mode);
    for(U32 i=0;i<experiments.size();++i) {
        const auto& variant=experiments[i];
        if(filter.empty() || filter==variant.id || (filter=="removals" && i>=1 && i<15) ||
            (filter=="additions" && i>=15 && i<26) ||
            (filter=="symmetric-subsets" && variant.id.rfind("symmetric-only-",0)==0) ||
            (filter=="fine-removals" && variant.id.rfind("drop-",0)==0)) solve(graph,variant);
    }
}
