from helpmeet.media_segments import normalize_segments


def test_orders_and_merges_overlaps():
    assert normalize_segments([(3, 5), (1, 2), (1.5, 4)], 10) == [(1.0, 5.0)]


def test_clamps_to_bounds():
    assert normalize_segments([(-1, 3)], 10) == [(0.0, 3.0)]
    assert normalize_segments([(5, 20)], 10) == [(5.0, 10.0)]


def test_drops_empty_or_inverted():
    assert normalize_segments([(5, 5), (4, 2)], 10) == []


def test_keeps_disjoint_sorted():
    assert normalize_segments([(8, 12), (2, 3)], 10) == [(2.0, 3.0), (8.0, 10.0)]
