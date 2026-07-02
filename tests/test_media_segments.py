import pytest

from helpmeet.media_segments import normalize_segments, map_local_to_global


def test_orders_and_merges_overlaps():
    assert normalize_segments([(3, 5), (1, 2), (1.5, 4)], 10) == [(1.0, 5.0)]


def test_clamps_to_bounds():
    assert normalize_segments([(-1, 3)], 10) == [(0.0, 3.0)]
    assert normalize_segments([(5, 20)], 10) == [(5.0, 10.0)]


def test_drops_empty_or_inverted():
    assert normalize_segments([(5, 5), (4, 2)], 10) == []


def test_keeps_disjoint_sorted():
    assert normalize_segments([(8, 12), (2, 3)], 10) == [(2.0, 3.0), (8.0, 10.0)]


def test_map_local_to_global_single():
    segs = [(1.0, 3.0)]
    assert map_local_to_global(0.0, segs) == 1.0
    assert map_local_to_global(1.5, segs) == 2.5


def test_map_local_to_global_multi():
    segs = [(1.0, 3.0), (4.0, 5.0)]
    assert map_local_to_global(0.0, segs) == 1.0
    assert map_local_to_global(2.0, segs) == 4.0
    assert map_local_to_global(2.5, segs) == 4.5


def test_map_local_to_global_past_end_clamps():
    segs = [(1.0, 3.0), (4.0, 5.0)]
    assert map_local_to_global(99.0, segs) == 5.0


def test_map_local_to_global_clamps_negative():
    assert map_local_to_global(-0.5, [(1.0, 3.0)]) == 1.0


def test_map_local_to_global_empty_raises():
    with pytest.raises(ValueError):
        map_local_to_global(0.0, [])
